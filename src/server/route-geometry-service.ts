import type { RouteGeometry, TravelMode } from "@/lib/types";
import { GoogleRoutesConfigError } from "@/server/errors";
import { computeGoogleRoute } from "@/server/google-routes";
import { getRouteGeometry as getSupabaseRouteGeometry } from "@/server/supabase-route-geometry-service";
import { recordGoogleRoutesCall } from "@/server/supabase-google-routes-usage-store";

type Coordinates = {
  latitude: number;
  longitude: number;
};

export async function getRouteGeometry(
  tripId: number,
  segmentId: number,
  userId?: string,
  ipHash: string | null = null,
): Promise<RouteGeometry> {
  const apiKey = getRoutesApiKey();
  if (!apiKey) {
    throw new GoogleRoutesConfigError(
      "Google Maps Routes API key is not configured.",
    );
  }

  return getSupabaseRouteGeometry(tripId, segmentId, apiKey, userId, ipHash);
}

export async function getRouteDurationSeconds(input: {
  from: Coordinates;
  to: Coordinates;
  mode: TravelMode;
  userId?: string;
}): Promise<number | null> {
  const apiKey = getRoutesApiKey();
  if (!apiKey) {
    throw new GoogleRoutesConfigError(
      "Google Maps Routes API key is not configured.",
    );
  }

  const route = await computeGoogleRoute({
    apiKey,
    from: input.from,
    to: input.to,
    mode: input.mode,
    includePolyline: false,
  });

  if (input.userId) {
    recordGoogleRoutesCall(input.userId).catch(() => {});
  }

  return route.status === "ok" ? (route.duration_seconds ?? null) : null;
}

function getRoutesApiKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_ROUTES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    null
  );
}
