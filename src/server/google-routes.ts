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
};

type GoogleRoutesResponse = {
  routes?: Array<{
    polyline?: {
      encodedPolyline?: unknown;
    };
  }>;
};

const ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
const REQUEST_TIMEOUT_MS = 10_000;

export async function computeGoogleRoute(input: ComputeRouteInput): Promise<Omit<RouteGeometry, "segment_id">> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ROUTES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": input.apiKey,
        "X-Goog-FieldMask": "routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: input.from } },
        destination: { location: { latLng: input.to } },
        travelMode: toGoogleTravelMode(input.mode),
        polylineEncoding: "ENCODED_POLYLINE",
        polylineQuality: "OVERVIEW",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new GoogleRoutesUpstreamError("Google Routes API request failed.", response.status === 504 ? 504 : 502);
    }

    const payload = (await response.json()) as GoogleRoutesResponse;
    const encodedPolyline = payload.routes?.[0]?.polyline?.encodedPolyline;

    return typeof encodedPolyline === "string" && encodedPolyline
      ? { status: "ok", encoded_polyline: encodedPolyline }
      : { status: "no_route" };
  } catch (error) {
    if (error instanceof GoogleRoutesUpstreamError) {
      throw error;
    }

    const status = error instanceof Error && error.name === "AbortError" ? 504 : 502;
    throw new GoogleRoutesUpstreamError("Google Routes API request failed.", status);
  } finally {
    clearTimeout(timeout);
  }
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
