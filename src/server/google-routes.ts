import type { RouteGeometry, TravelMode } from "@/lib/types";
import { GoogleRoutesUpstreamError } from "@/server/errors";

type ComputeRouteInput = {
  apiKey: string;
  from: {
    latitude: number;
    longitude: number;
  };
  to: {
    latitude: number;
    longitude: number;
  };
  mode: TravelMode;
  includePolyline?: boolean;
};

type GoogleRoutesResponse = {
  routes?: Array<{
    duration?: unknown;
    polyline?: {
      encodedPolyline?: unknown;
    };
  }>;
};

const ROUTES_ENDPOINT =
  "https://routes.googleapis.com/directions/v2:computeRoutes";
const REQUEST_TIMEOUT_MS = 10_000;

export async function computeGoogleRoute(
  input: ComputeRouteInput,
): Promise<Omit<RouteGeometry, "segment_id">> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const includePolyline = input.includePolyline ?? true;

  try {
    const response = await fetch(ROUTES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": input.apiKey,
        "X-Goog-FieldMask": includePolyline
          ? "routes.duration,routes.polyline.encodedPolyline"
          : "routes.duration",
      },
      body: JSON.stringify({
        origin: { location: { latLng: input.from } },
        destination: { location: { latLng: input.to } },
        travelMode: toGoogleTravelMode(input.mode),
        ...(includePolyline
          ? {
              polylineEncoding: "ENCODED_POLYLINE",
              polylineQuality: "OVERVIEW",
            }
          : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new GoogleRoutesUpstreamError(
        "Google Routes API request failed.",
        response.status === 504 ? 504 : 502,
      );
    }

    const payload = (await response.json()) as GoogleRoutesResponse;
    const route = payload.routes?.[0];
    const encodedPolyline = route?.polyline?.encodedPolyline;
    const durationSeconds = parseGoogleDuration(route?.duration);

    if (!includePolyline) {
      return durationSeconds === null
        ? { status: "no_route" }
        : { status: "ok", duration_seconds: durationSeconds };
    }

    return typeof encodedPolyline === "string" && encodedPolyline
      ? {
          status: "ok",
          encoded_polyline: encodedPolyline,
          duration_seconds: durationSeconds ?? undefined,
        }
      : { status: "no_route" };
  } catch (error) {
    if (error instanceof GoogleRoutesUpstreamError) {
      throw error;
    }

    const status =
      error instanceof Error && error.name === "AbortError" ? 504 : 502;
    throw new GoogleRoutesUpstreamError(
      "Google Routes API request failed.",
      status,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function parseGoogleDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;

  const match = /^(\d+)s$/.exec(value);
  if (!match) return null;

  return Number(match[1]);
}

function toGoogleTravelMode(mode: TravelMode): string {
  switch (mode) {
    case "driving":
      return "DRIVE";
    case "transit":
      return "TRANSIT";
    case "bicycling":
      return "BICYCLE";
    case "walking":
      return "WALK";
  }
}
