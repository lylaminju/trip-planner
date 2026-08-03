import { findDestinationTimeZone } from "@/lib/destination-options";
import {
  resolveTransitDeparture,
  TRANSIT_BUCKET_NOW,
  type TransitDeparture,
} from "@/lib/transit-departure";
import type { RouteGeometry, TravelMode } from "@/lib/types";
import { RouteSegmentNotFoundError } from "@/server/errors";
import { computeGoogleRoute } from "@/server/google-routes";
import { getSupabaseClient } from "@/server/supabase";
import {
  assertGoogleRoutesQuota,
  recordGoogleRoutesCall,
} from "@/server/supabase-google-routes-usage-store";

// A cached route is identified by the route itself — mode, coordinates and, for
// transit, the departure bucket — never by the place rows that happen to
// reference it. Place ids are per trip, so keying on them made every trip pay
// again for geometry another trip already had.
export type CacheableRoute = {
  mode: TravelMode;
  from_latitude: number;
  from_longitude: number;
  to_latitude: number;
  to_longitude: number;
  departure: TransitDeparture;
};

type SegmentRouteRow = CacheableRoute & {
  segment_id: number;
};

type JoinedPlace = {
  latitude: number;
  longitude: number;
};

type JoinedItem = {
  visit_date?: string | null;
  visit_time?: string | null;
  place: JoinedPlace | JoinedPlace[] | null;
};

type JoinedTrip = {
  destination_slug: string | null;
  destination: string | null;
};

type RouteSegmentJoinRow = {
  id: number;
  mode: TravelMode;
  trip: JoinedTrip | JoinedTrip[] | null;
  from_item: JoinedItem | JoinedItem[] | null;
  to_item: JoinedItem | JoinedItem[] | null;
};

type RouteGeometryCacheRow = {
  status: "ok" | "no_route";
  encoded_polyline: string | null;
  duration_seconds: number | null;
};

// One expiry for every mode. Transit varies by time of day, but that is handled
// by the departure bucket in the cache key, not by expiring rows sooner: a
// Saturday-10:00 row is only ever read for Saturday-10:00 departures. Expiry
// covers the slower concern of agencies republishing timetables.
const CACHE_MAX_AGE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function getRouteGeometry(
  tripId: number,
  segmentId: number,
  apiKey: string,
  userId?: string,
  ipHash: string | null = null,
): Promise<RouteGeometry> {
  const segment = await getSegmentRouteRow(tripId, segmentId);
  const cacheKey = routeGeometryCacheKey(segment);
  const cached = await getCachedRouteGeometry(cacheKey);

  if (cached && hasRenderableGeometry(cached)) {
    return toRouteGeometry(segmentId, cached);
  }

  // Quota is asserted only on a cache miss: serving cached geometry costs
  // nothing, so it never burns a daily slot.
  if (userId) {
    await assertGoogleRoutesQuota(userId);
  }

  const computed = await computeGoogleRoute({
    apiKey,
    from: {
      latitude: segment.from_latitude,
      longitude: segment.from_longitude,
    },
    to: {
      latitude: segment.to_latitude,
      longitude: segment.to_longitude,
    },
    mode: segment.mode,
    ...(segment.departure.departureTime
      ? { departureTime: segment.departure.departureTime }
      : {}),
  });

  if (userId) {
    recordGoogleRoutesCall(userId, ipHash).catch(() => {});
  }

  await saveRouteGeometry(cacheKey, segment, computed);
  return { segment_id: segmentId, ...computed };
}

async function getSegmentRouteRow(
  tripId: number,
  segmentId: number,
): Promise<SegmentRouteRow> {
  const { data, error } = await getSupabaseClient()
    .from("route_segments")
    .select(
      `
        id,
        mode,
        trip:trips (destination_slug, destination),
        from_item:itinerary_items!route_segments_from_item_id_fkey (
          visit_date,
          visit_time,
          place:places (latitude, longitude)
        ),
        to_item:itinerary_items!route_segments_to_item_id_fkey (
          place:places (latitude, longitude)
        )
      `,
    )
    .eq("trip_id", tripId)
    .eq("id", segmentId)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  if (!data) throw new RouteSegmentNotFoundError(segmentId);

  const row = data as unknown as RouteSegmentJoinRow;
  const fromItem = firstJoinedItem(row.from_item);
  const fromPlace = firstJoinedPlace(fromItem?.place);
  const toPlace = firstJoinedPlace(firstJoinedItem(row.to_item)?.place);
  if (!fromPlace || !toPlace) {
    throw new RouteSegmentNotFoundError(segmentId);
  }

  return {
    segment_id: row.id,
    mode: row.mode,
    from_latitude: fromPlace.latitude,
    from_longitude: fromPlace.longitude,
    to_latitude: toPlace.latitude,
    to_longitude: toPlace.longitude,
    departure: segmentDeparture(row.mode, fromItem, firstJoinedTrip(row.trip)),
  };
}

// Only transit needs a departure: the other modes are clock-independent as we
// request them, so they stay on one shared row per route.
function segmentDeparture(
  mode: TravelMode,
  fromItem: JoinedItem | null,
  trip: JoinedTrip | null,
): TransitDeparture {
  if (mode !== "transit") {
    return { bucket: TRANSIT_BUCKET_NOW, departureTime: null };
  }

  return resolveTransitDeparture({
    visitDate: fromItem?.visit_date ?? null,
    visitTime: fromItem?.visit_time ?? null,
    timeZone: findDestinationTimeZone(
      trip?.destination_slug ?? trip?.destination,
    ),
    now: new Date(),
  });
}

async function getCachedRouteGeometry(
  cacheKey: string,
): Promise<RouteGeometryCacheRow | null> {
  const cutoff = new Date(
    Date.now() - CACHE_MAX_AGE_DAYS * MS_PER_DAY,
  ).toISOString();
  const { data, error } = await getSupabaseClient()
    .from("route_geometry_cache")
    .select("status, encoded_polyline, duration_seconds")
    .eq("cache_key", cacheKey)
    .gte("updated_at", cutoff)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return (data as RouteGeometryCacheRow | null) ?? null;
}

// A cached row satisfies the map only when it is complete: no_route is a
// definitive answer, while an "ok" row must carry both the polyline and the
// duration. Duration-only rows written by probe callers and legacy rows that
// predate duration capture are misses here; the refetch upserts the full row
// over the same cache key.
function hasRenderableGeometry(cached: RouteGeometryCacheRow): boolean {
  if (cached.status === "no_route") return true;
  return Boolean(cached.encoded_polyline) && cached.duration_seconds !== null;
}

async function saveRouteGeometry(
  cacheKey: string,
  route: CacheableRoute,
  geometry: Omit<RouteGeometry, "segment_id">,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await getSupabaseClient()
    .from("route_geometry_cache")
    .upsert(
      {
        cache_key: cacheKey,
        mode: route.mode,
        from_latitude: route.from_latitude,
        from_longitude: route.from_longitude,
        to_latitude: route.to_latitude,
        to_longitude: route.to_longitude,
        status: geometry.status,
        encoded_polyline: geometry.encoded_polyline ?? null,
        duration_seconds: geometry.duration_seconds ?? null,
        updated_at: now,
      },
      { onConflict: "cache_key" },
    );

  if (error) throwSupabaseError(error);
}

function toRouteGeometry(
  segmentId: number,
  cached: RouteGeometryCacheRow,
): RouteGeometry {
  if (cached.status === "ok" && cached.encoded_polyline) {
    return {
      segment_id: segmentId,
      status: "ok",
      encoded_polyline: cached.encoded_polyline,
      duration_seconds: cached.duration_seconds ?? undefined,
    };
  }

  return {
    segment_id: segmentId,
    status: "no_route",
  };
}

export function routeGeometryCacheKey(route: CacheableRoute): string {
  const parts = [
    route.mode,
    coordinateKey(route.from_latitude),
    coordinateKey(route.from_longitude),
    coordinateKey(route.to_latitude),
    coordinateKey(route.to_longitude),
  ];
  // Only transit rows carry a departure bucket, so clock-independent modes keep
  // a single shared row per route.
  if (route.mode === "transit") {
    parts.push(route.departure.bucket);
  }
  return parts.join(":");
}

// Duration reuse for callers such as the AI planner's walking probes: a full
// row and a duration-only row both count, and a cached no_route is a
// definitive "no duration" rather than a reason to pay for the same answer
// again. Null means a true miss — the caller must compute.
export type CachedRouteDuration = { durationSeconds: number | null };

export async function cachedRouteDurationSeconds(
  route: CacheableRoute,
): Promise<CachedRouteDuration | null> {
  const cached = await getCachedRouteGeometry(routeGeometryCacheKey(route));
  if (!cached) return null;
  if (cached.status === "no_route") return { durationSeconds: null };
  return cached.duration_seconds !== null
    ? { durationSeconds: cached.duration_seconds }
    : null;
}

// Persist a duration-only result so repeat probes stop paying for the same
// route. The row carries no polyline, so the full-geometry path treats it as
// a miss and still fetches the real path once the map needs it; that refetch
// fills in the polyline on the same cache key.
export async function saveRouteDurationSeconds(
  route: CacheableRoute,
  result: Omit<RouteGeometry, "segment_id">,
): Promise<void> {
  await saveRouteGeometry(routeGeometryCacheKey(route), route, {
    status: result.status,
    duration_seconds: result.duration_seconds,
  });
}

function coordinateKey(value: number): string {
  return value.toFixed(6);
}

function firstJoinedItem(
  item: JoinedItem | JoinedItem[] | null,
): JoinedItem | null {
  return Array.isArray(item) ? (item[0] ?? null) : item;
}

function firstJoinedPlace(
  place: JoinedPlace | JoinedPlace[] | null | undefined,
): JoinedPlace | null {
  return Array.isArray(place) ? (place[0] ?? null) : (place ?? null);
}

function firstJoinedTrip(
  trip: JoinedTrip | JoinedTrip[] | null,
): JoinedTrip | null {
  return Array.isArray(trip) ? (trip[0] ?? null) : trip;
}

function throwSupabaseError(error: { message: string }): never {
  throw new Error(`Supabase query failed: ${error.message}`);
}
