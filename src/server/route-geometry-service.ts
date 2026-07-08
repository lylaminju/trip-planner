import type { RouteGeometry, TravelMode } from "@/lib/types";
import { GoogleRoutesConfigError } from "@/server/errors";
import { computeGoogleRoute } from "@/server/google-routes";
import { getRouteGeometry as getSupabaseRouteGeometry } from "@/server/supabase-route-geometry-service";

type Coordinates = {
  latitude: number;
  longitude: number;
};

export async function getRouteGeometry(
  tripId: number,
  segmentId: number,
): Promise<RouteGeometry> {
  const apiKey = getRoutesApiKey();
  if (!apiKey) {
    throw new GoogleRoutesConfigError(
      "Google Maps Routes API key is not configured.",
    );
  }

  return getSupabaseRouteGeometry(tripId, segmentId, apiKey);
}

export async function getRouteDurationSeconds(input: {
  from: Coordinates;
  to: Coordinates;
  mode: TravelMode;
}): Promise<number | null> {
  const apiKey = getRoutesApiKey();
  if (!apiKey) {
    throw new GoogleRoutesConfigError(
      "Google Maps Routes API key is not configured.",
    );
  }

  const route = await computeGoogleRoute({
    apiKey,
    ...input,
    includePolyline: false,
  });
  return route.status === "ok" ? (route.duration_seconds ?? null) : null;
}

function getRoutesApiKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_ROUTES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    null
  );
}
