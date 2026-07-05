import type { ItineraryItem, RouteGeometry, RouteSegment } from "@/lib/types";

export const ROUTE_GEOMETRY_BROWSER_CACHE_MAX_AGE_MS =
  30 * 24 * 60 * 60 * 1000;

const ROUTE_GEOMETRY_BROWSER_CACHE_KEY =
  "trip-planner:route-geometries:v1";
const ROUTE_GEOMETRY_BROWSER_CACHE_MAX_ENTRIES = 500;

export type RouteGeometryBrowserCacheStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

type StoredRouteGeometryCache = {
  entries: Record<string, RouteGeometryBrowserCacheEntry>;
};

type RouteGeometryBrowserCacheEntry = {
  tripId: number;
  segmentId: number;
  signature: string;
  geometry: RouteGeometry;
  savedAt: number;
};

export function getRouteGeometryBrowserCacheStorage():
  | RouteGeometryBrowserCacheStorage
  | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function routeGeometryBrowserCacheSignature(
  segment: RouteSegment,
  itemsById: Map<number, ItineraryItem>,
): string {
  const from = itemsById.get(segment.from_item_id);
  const to = itemsById.get(segment.to_item_id);

  return [
    segment.id,
    segment.from_item_id,
    segment.to_item_id,
    segment.mode,
    coordinateKey(from?.place.latitude),
    coordinateKey(from?.place.longitude),
    coordinateKey(to?.place.latitude),
    coordinateKey(to?.place.longitude),
  ].join(":");
}

export function readRouteGeometryBrowserCache(input: {
  storage: RouteGeometryBrowserCacheStorage | null | undefined;
  tripId: number;
  signatures: Map<number, string>;
  now?: number;
}): Map<number, RouteGeometry> {
  const geometries = new Map<number, RouteGeometry>();
  if (!input.storage || input.signatures.size === 0) {
    return geometries;
  }

  const cache = readStoredCache(input.storage);
  const now = input.now ?? Date.now();
  let changed = false;

  for (const [segmentId, signature] of input.signatures) {
    const entryKey = routeGeometryCacheEntryKey(input.tripId, signature);
    const entry = cache.entries[entryKey];
    if (!entry) continue;

    if (
      !isFreshEntry(entry, now) ||
      entry.tripId !== input.tripId ||
      entry.segmentId !== segmentId ||
      entry.signature !== signature ||
      entry.geometry.segment_id !== segmentId
    ) {
      delete cache.entries[entryKey];
      changed = true;
      continue;
    }

    geometries.set(segmentId, entry.geometry);
  }

  if (changed) {
    writeStoredCache(input.storage, cache);
  }

  return geometries;
}

export function pruneRouteGeometryBrowserCache(input: {
  storage: RouteGeometryBrowserCacheStorage | null | undefined;
  tripId: number;
  signatures: Map<number, string>;
  now?: number;
}): void {
  if (!input.storage) {
    return;
  }

  const now = input.now ?? Date.now();
  const cache = readStoredCache(input.storage);
  let changed = pruneStoredCache(cache, now);

  for (const [key, entry] of Object.entries(cache.entries)) {
    if (entry.tripId !== input.tripId) {
      continue;
    }

    const currentSignature = input.signatures.get(entry.segmentId);
    if (
      !currentSignature ||
      entry.signature !== currentSignature ||
      entry.geometry.segment_id !== entry.segmentId
    ) {
      delete cache.entries[key];
      changed = true;
    }
  }

  if (changed) {
    writeStoredCache(input.storage, cache);
  }
}

export function writeRouteGeometryBrowserCache(input: {
  storage: RouteGeometryBrowserCacheStorage | null | undefined;
  tripId: number;
  signature: string | undefined;
  geometry: RouteGeometry;
  now?: number;
}): void {
  if (!input.storage || !input.signature) {
    return;
  }

  const now = input.now ?? Date.now();
  const cache = readStoredCache(input.storage);
  const entryKey = routeGeometryCacheEntryKey(input.tripId, input.signature);
  cache.entries[entryKey] = {
    tripId: input.tripId,
    segmentId: input.geometry.segment_id,
    signature: input.signature,
    geometry: input.geometry,
    savedAt: now,
  };

  pruneStoredCache(cache, now);
  writeStoredCache(input.storage, cache);
}

function routeGeometryCacheEntryKey(tripId: number, signature: string): string {
  return `${tripId}:${signature}`;
}

function coordinateKey(value: number | undefined): string {
  return typeof value === "number" ? value.toFixed(6) : "";
}

function readStoredCache(
  storage: RouteGeometryBrowserCacheStorage,
): StoredRouteGeometryCache {
  try {
    const raw = storage.getItem(ROUTE_GEOMETRY_BROWSER_CACHE_KEY);
    if (!raw) {
      return emptyStoredCache();
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.entries)) {
      return emptyStoredCache();
    }

    const entries: Record<string, RouteGeometryBrowserCacheEntry> = {};
    for (const [key, value] of Object.entries(parsed.entries)) {
      if (isCacheEntry(value)) {
        entries[key] = value;
      }
    }

    return { entries };
  } catch {
    return emptyStoredCache();
  }
}

function writeStoredCache(
  storage: RouteGeometryBrowserCacheStorage,
  cache: StoredRouteGeometryCache,
): void {
  try {
    storage.setItem(ROUTE_GEOMETRY_BROWSER_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Browser storage may be disabled, full, or unavailable in private contexts.
  }
}

function pruneStoredCache(
  cache: StoredRouteGeometryCache,
  now: number,
): boolean {
  let changed = false;

  for (const [key, entry] of Object.entries(cache.entries)) {
    if (!isFreshEntry(entry, now)) {
      delete cache.entries[key];
      changed = true;
    }
  }

  const entries = Object.entries(cache.entries);
  if (entries.length <= ROUTE_GEOMETRY_BROWSER_CACHE_MAX_ENTRIES) {
    return changed;
  }

  entries
    .sort(([, left], [, right]) => left.savedAt - right.savedAt)
    .slice(0, entries.length - ROUTE_GEOMETRY_BROWSER_CACHE_MAX_ENTRIES)
    .forEach(([key]) => {
      delete cache.entries[key];
      changed = true;
    });

  return changed;
}

function emptyStoredCache(): StoredRouteGeometryCache {
  return { entries: {} };
}

function isFreshEntry(
  entry: RouteGeometryBrowserCacheEntry,
  now: number,
): boolean {
  return now - entry.savedAt <= ROUTE_GEOMETRY_BROWSER_CACHE_MAX_AGE_MS;
}

function isCacheEntry(value: unknown): value is RouteGeometryBrowserCacheEntry {
  if (!isRecord(value) || !isRouteGeometry(value.geometry)) {
    return false;
  }

  return (
    typeof value.tripId === "number" &&
    typeof value.segmentId === "number" &&
    typeof value.signature === "string" &&
    typeof value.savedAt === "number"
  );
}

function isRouteGeometry(value: unknown): value is RouteGeometry {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.segment_id !== "number") {
    return false;
  }

  if (value.status !== "ok" && value.status !== "no_route") {
    return false;
  }

  if (
    value.encoded_polyline !== undefined &&
    typeof value.encoded_polyline !== "string"
  ) {
    return false;
  }

  return (
    value.duration_seconds === undefined ||
    typeof value.duration_seconds === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
