import type { RouteGeometry, TravelMode } from "@/lib/types";
import { RouteSegmentNotFoundError } from "@/server/errors";
import { computeGoogleRoute } from "@/server/google-routes";
import { getSupabaseClient } from "@/server/supabase";
import {
  assertGoogleRoutesQuota,
  recordGoogleRoutesCall,
} from "@/server/supabase-google-routes-usage-store";

type SegmentRouteRow = {
  segment_id: number;
  mode: TravelMode;
  from_place_id: number;
  from_latitude: number;
  from_longitude: number;
  to_place_id: number;
  to_latitude: number;
  to_longitude: number;
};

type RouteSegmentJoinRow = {
  id: number;
  mode: TravelMode;
  from_item:
    | {
        place:
          | {
              id: number;
              latitude: number;
              longitude: number;
            }
          | Array<{
              id: number;
              latitude: number;
              longitude: number;
            }>
          | null;
      }
    | Array<{
        place:
          | {
              id: number;
              latitude: number;
              longitude: number;
            }
          | Array<{
              id: number;
              latitude: number;
              longitude: number;
            }>
          | null;
      }>
    | null;
  to_item:
    | {
        place:
          | {
              id: number;
              latitude: number;
              longitude: number;
            }
          | Array<{
              id: number;
              latitude: number;
              longitude: number;
            }>
          | null;
      }
    | Array<{
        place:
          | {
              id: number;
              latitude: number;
              longitude: number;
            }
          | Array<{
              id: number;
              latitude: number;
              longitude: number;
            }>
          | null;
      }>
    | null;
};

type JoinedPlace = {
  id: number;
  latitude: number;
  longitude: number;
};

type JoinedItem = {
  place: JoinedPlace | JoinedPlace[] | null;
};

type RouteGeometryCacheRow = {
  status: "ok" | "no_route";
  encoded_polyline: string | null;
  duration_seconds: number | null;
};

const CACHE_MAX_AGE_DAYS = 30;

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

  if (cached) {
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
        from_item:itinerary_items!route_segments_from_item_id_fkey (
          place:places (id, latitude, longitude)
        ),
        to_item:itinerary_items!route_segments_to_item_id_fkey (
          place:places (id, latitude, longitude)
        )
      `,
    )
    .eq("trip_id", tripId)
    .eq("id", segmentId)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  if (!data) throw new RouteSegmentNotFoundError(segmentId);

  const row = data as unknown as RouteSegmentJoinRow;
  const fromPlace = firstJoinedPlace(firstJoinedItem(row.from_item)?.place);
  const toPlace = firstJoinedPlace(firstJoinedItem(row.to_item)?.place);
  if (!fromPlace || !toPlace) {
    throw new RouteSegmentNotFoundError(segmentId);
  }

  return {
    segment_id: row.id,
    mode: row.mode,
    from_place_id: fromPlace.id,
    from_latitude: fromPlace.latitude,
    from_longitude: fromPlace.longitude,
    to_place_id: toPlace.id,
    to_latitude: toPlace.latitude,
    to_longitude: toPlace.longitude,
  };
}

async function getCachedRouteGeometry(
  cacheKey: string,
): Promise<RouteGeometryCacheRow | null> {
  const cutoff = new Date(
    Date.now() - CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await getSupabaseClient()
    .from("route_geometry_cache")
    .select("status, encoded_polyline, duration_seconds")
    .eq("cache_key", cacheKey)
    .gte("updated_at", cutoff)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  const cached = (data as RouteGeometryCacheRow | null) ?? null;
  if (
    cached?.status === "ok" &&
    cached.encoded_polyline &&
    cached.duration_seconds === null
  ) {
    return null;
  }
  return cached;
}

async function saveRouteGeometry(
  cacheKey: string,
  segment: SegmentRouteRow,
  geometry: Omit<RouteGeometry, "segment_id">,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await getSupabaseClient()
    .from("route_geometry_cache")
    .upsert(
      {
        cache_key: cacheKey,
        from_place_id: segment.from_place_id,
        to_place_id: segment.to_place_id,
        mode: segment.mode,
        from_latitude: segment.from_latitude,
        from_longitude: segment.from_longitude,
        to_latitude: segment.to_latitude,
        to_longitude: segment.to_longitude,
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

// Also used by guest sample-trip cloning to re-key copied geometry rows for
// the cloned place ids, so clones render routes without new Routes calls.
export function routeGeometryCacheKey(
  segment: Omit<SegmentRouteRow, "segment_id">,
): string {
  return [
    segment.from_place_id,
    segment.to_place_id,
    segment.mode,
    coordinateKey(segment.from_latitude),
    coordinateKey(segment.from_longitude),
    coordinateKey(segment.to_latitude),
    coordinateKey(segment.to_longitude),
  ].join(":");
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

function throwSupabaseError(error: { message: string }): never {
  throw new Error(`Supabase query failed: ${error.message}`);
}
