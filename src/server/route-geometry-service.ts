import type Database from "better-sqlite3";

import type { RouteGeometry, TravelMode } from "@/lib/types";
import { getDatabase } from "@/server/db";
import { GoogleRoutesConfigError, RouteSegmentNotFoundError } from "@/server/errors";
import { computeGoogleRoute } from "@/server/google-routes";

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

type RouteGeometryCacheRow = {
  status: "ok" | "no_route";
  encoded_polyline: string | null;
};

const CACHE_MAX_AGE_DAYS = 30;

export async function getRouteGeometry(segmentId: number): Promise<RouteGeometry> {
  const db = getDatabase();
  const segment = getSegmentRouteRow(db, segmentId);
  const cacheKey = routeGeometryCacheKey(segment);
  const cached = getCachedRouteGeometry(db, cacheKey);

  if (cached) {
    return toRouteGeometry(segmentId, cached);
  }

  const apiKey = getRoutesApiKey();
  if (!apiKey) {
    throw new GoogleRoutesConfigError("Google Maps Routes API key is not configured.");
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

  saveRouteGeometry(db, cacheKey, segment, computed);
  return { segment_id: segmentId, ...computed };
}

function getSegmentRouteRow(db: Database.Database, segmentId: number): SegmentRouteRow {
  const row = db
    .prepare(
      `SELECT
        route_segments.id AS segment_id,
        route_segments.mode AS mode,
        from_places.id AS from_place_id,
        from_places.latitude AS from_latitude,
        from_places.longitude AS from_longitude,
        to_places.id AS to_place_id,
        to_places.latitude AS to_latitude,
        to_places.longitude AS to_longitude
      FROM route_segments
      JOIN itinerary_items AS from_items ON from_items.id = route_segments.from_item_id
      JOIN itinerary_items AS to_items ON to_items.id = route_segments.to_item_id
      JOIN places AS from_places ON from_places.id = from_items.place_id
      JOIN places AS to_places ON to_places.id = to_items.place_id
      WHERE route_segments.id = ?`,
    )
    .get(segmentId) as SegmentRouteRow | undefined;

  if (!row) {
    throw new RouteSegmentNotFoundError(segmentId);
  }

  return row;
}

function getCachedRouteGeometry(
  db: Database.Database,
  cacheKey: string,
): RouteGeometryCacheRow | null {
  return (
    (db
      .prepare(
        `SELECT status, encoded_polyline
        FROM route_geometry_cache
        WHERE cache_key = ?
          AND updated_at >= datetime('now', ?)`,
      )
      .get(cacheKey, `-${CACHE_MAX_AGE_DAYS} days`) as RouteGeometryCacheRow | undefined) ?? null
  );
}

function saveRouteGeometry(
  db: Database.Database,
  cacheKey: string,
  segment: SegmentRouteRow,
  geometry: Omit<RouteGeometry, "segment_id">,
): void {
  db.prepare(
    `INSERT INTO route_geometry_cache (
      cache_key, from_place_id, to_place_id, mode, from_latitude, from_longitude,
      to_latitude, to_longitude, status, encoded_polyline
    ) VALUES (
      @cache_key, @from_place_id, @to_place_id, @mode, @from_latitude, @from_longitude,
      @to_latitude, @to_longitude, @status, @encoded_polyline
    )
    ON CONFLICT(cache_key) DO UPDATE SET
      status = excluded.status,
      encoded_polyline = excluded.encoded_polyline,
      updated_at = CURRENT_TIMESTAMP`,
  ).run({
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
  });
}

function toRouteGeometry(segmentId: number, cached: RouteGeometryCacheRow): RouteGeometry {
  if (cached.status === "ok" && cached.encoded_polyline) {
    return {
      segment_id: segmentId,
      status: "ok",
      encoded_polyline: cached.encoded_polyline,
    };
  }

  return {
    segment_id: segmentId,
    status: "no_route",
  };
}

function routeGeometryCacheKey(segment: SegmentRouteRow): string {
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

function getRoutesApiKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_ROUTES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    null
  );
}
