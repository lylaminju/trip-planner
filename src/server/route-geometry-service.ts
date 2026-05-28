import type { RouteGeometry } from "@/lib/types";
import { GoogleRoutesConfigError } from "@/server/errors";
import { getRouteGeometry as getSupabaseRouteGeometry } from "@/server/supabase-route-geometry-service";

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

function getRoutesApiKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_ROUTES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    null
  );
}
