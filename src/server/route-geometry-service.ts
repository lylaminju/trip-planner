import { TRANSIT_BUCKET_NOW } from "@/lib/transit-departure";
import type { RouteGeometry, TravelMode } from "@/lib/types";
import { GoogleRoutesConfigError } from "@/server/errors";
import { computeGoogleRoute } from "@/server/google-routes";
import {
  cachedRouteDurationSeconds,
  getRouteGeometry as getSupabaseRouteGeometry,
  type CacheableRoute,
} from "@/server/supabase-route-geometry-service";
import { recordGoogleRoutesCall } from "@/server/supabase-google-routes-usage-store";
import type { Coordinates } from "@/lib/geo-distance";

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
  // Reuse a duration the map already paid for before spending a call. Callers
  // here have coordinates but no itinerary context, so a transit lookup carries
  // no departure bucket and simply misses rather than reusing another schedule.
  const cached = await cachedRouteDurationSeconds(cacheableRoute(input));
  if (cached !== null) return cached;

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

function cacheableRoute(input: {
  from: Coordinates;
  to: Coordinates;
  mode: TravelMode;
}): CacheableRoute {
  return {
    mode: input.mode,
    from_latitude: input.from.latitude,
    from_longitude: input.from.longitude,
    to_latitude: input.to.latitude,
    to_longitude: input.to.longitude,
    departure: { bucket: TRANSIT_BUCKET_NOW, departureTime: null },
  };
}

function getRoutesApiKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_ROUTES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    null
  );
}
