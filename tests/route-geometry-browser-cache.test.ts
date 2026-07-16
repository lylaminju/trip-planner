import { describe, expect, it } from "vitest";

import {
  ROUTE_GEOMETRY_BROWSER_CACHE_MAX_AGE_MS,
  pruneRouteGeometryBrowserCache,
  readRouteGeometryBrowserCache,
  routeGeometryBrowserCacheSignature,
  writeRouteGeometryBrowserCache,
} from "@/lib/route-geometry-browser-cache";
import type { ItineraryItem, RouteGeometry, RouteSegment } from "@/lib/types";

describe("route geometry browser cache", () => {
  it("hydrates only matching route signatures for the current trip snapshot", () => {
    const storage = new MemoryStorage();
    const route = routeFixture();
    const matchingSignature = routeGeometryBrowserCacheSignature(
      route.segment,
      route.itemsById,
    );
    const geometry = geometryFixture(route.segment.id);

    writeRouteGeometryBrowserCache({
      storage,
      tripId: 10,
      signature: matchingSignature,
      geometry,
      now: 1000,
    });

    const matching = readRouteGeometryBrowserCache({
      storage,
      tripId: 10,
      signatures: new Map([[route.segment.id, matchingSignature]]),
      now: 1000,
    });
    expect(matching.get(route.segment.id)).toEqual(geometry);

    const changedMode = {
      ...route.segment,
      mode: "driving" as const,
    };
    const changedSignature = routeGeometryBrowserCacheSignature(
      changedMode,
      route.itemsById,
    );
    const mismatched = readRouteGeometryBrowserCache({
      storage,
      tripId: 10,
      signatures: new Map([[changedMode.id, changedSignature]]),
      now: 1000,
    });
    expect(mismatched.has(changedMode.id)).toBe(false);
  });

  it("removes stale entries for changed or removed current-trip segments", () => {
    const storage = new MemoryStorage();
    const route = routeFixture();
    const originalSignature = routeGeometryBrowserCacheSignature(
      route.segment,
      route.itemsById,
    );
    const changedMode = {
      ...route.segment,
      mode: "driving" as const,
    };
    const changedSignature = routeGeometryBrowserCacheSignature(
      changedMode,
      route.itemsById,
    );
    const otherSegmentSignature = "20:201:202:walking:1.000000:2.000000:3.000000:4.000000";

    writeRouteGeometryBrowserCache({
      storage,
      tripId: 10,
      signature: originalSignature,
      geometry: geometryFixture(route.segment.id),
      now: 1000,
    });
    writeRouteGeometryBrowserCache({
      storage,
      tripId: 10,
      signature: otherSegmentSignature,
      geometry: geometryFixture(20),
      now: 1000,
    });
    writeRouteGeometryBrowserCache({
      storage,
      tripId: 11,
      signature: originalSignature,
      geometry: geometryFixture(route.segment.id),
      now: 1000,
    });

    pruneRouteGeometryBrowserCache({
      storage,
      tripId: 10,
      signatures: new Map([[route.segment.id, changedSignature]]),
      now: 1000,
    });

    expect(storedEntries(storage)).toEqual([
      {
        tripId: 11,
        segmentId: route.segment.id,
        signature: originalSignature,
      },
    ]);
  });

  it("ignores expired entries and removes them from storage", () => {
    const storage = new MemoryStorage();
    const route = routeFixture();
    const signature = routeGeometryBrowserCacheSignature(
      route.segment,
      route.itemsById,
    );

    writeRouteGeometryBrowserCache({
      storage,
      tripId: 10,
      signature,
      geometry: geometryFixture(route.segment.id),
      now: 1000,
    });

    const cached = readRouteGeometryBrowserCache({
      storage,
      tripId: 10,
      signatures: new Map([[route.segment.id, signature]]),
      now: 1000 + ROUTE_GEOMETRY_BROWSER_CACHE_MAX_AGE_MS + 1,
    });

    expect(cached.size).toBe(0);
    expect(storage.rawValue()).not.toContain("encoded-12");
  });

  it("tolerates corrupt or unavailable browser storage", () => {
    const storage = new MemoryStorage();
    storage.setRawValue("{");
    const route = routeFixture();
    const signature = routeGeometryBrowserCacheSignature(
      route.segment,
      route.itemsById,
    );

    expect(() =>
      writeRouteGeometryBrowserCache({
        storage,
        tripId: 10,
        signature,
        geometry: geometryFixture(route.segment.id),
        now: 1000,
      }),
    ).not.toThrow();

    const unavailableStorage = {
      getItem() {
        throw new Error("storage unavailable");
      },
      setItem() {
        throw new Error("storage unavailable");
      },
    };

    expect(
      readRouteGeometryBrowserCache({
        storage: unavailableStorage,
        tripId: 10,
        signatures: new Map([[route.segment.id, signature]]),
        now: 1000,
      }).size,
    ).toBe(0);
    expect(() =>
      writeRouteGeometryBrowserCache({
        storage: unavailableStorage,
        tripId: 10,
        signature,
        geometry: geometryFixture(route.segment.id),
        now: 1000,
      }),
    ).not.toThrow();
  });
});

function routeFixture(): {
  segment: RouteSegment;
  itemsById: Map<number, ItineraryItem>;
} {
  const fromItem = itineraryItemFixture({
    id: 101,
    latitude: 35.681236,
    longitude: 139.767125,
  });
  const toItem = itineraryItemFixture({
    id: 102,
    latitude: 35.658581,
    longitude: 139.745433,
  });
  return {
    segment: {
      id: 12,
      trip_id: 10,
      from_item_id: fromItem.id,
      to_item_id: toItem.id,
      mode: "walking",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    },
    itemsById: new Map([
      [fromItem.id, fromItem],
      [toItem.id, toItem],
    ]),
  };
}

function itineraryItemFixture(input: {
  id: number;
  latitude: number;
  longitude: number;
}): ItineraryItem {
  return {
    id: input.id,
    trip_id: 10,
    place_id: input.id + 1000,
    visit_date: "2026-07-01",
    visit_time: "09:00",
    notes: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    place: {
      id: input.id + 1000,
      trip_id: 10,
      name: `Place ${input.id}`,
      address: null,
      google_maps_url: "https://maps.google.com",
      place_id: null,
      google_place_token: null,
      google_internal_ids: null,
      source_list_url: null,
      latitude: input.latitude,
      longitude: input.longitude,
      notes: null,
      links: [],
      image_url: null,
      image_credit: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    },
  };
}

function geometryFixture(segmentId: number): RouteGeometry {
  return {
    segment_id: segmentId,
    status: "ok",
    encoded_polyline: `encoded-${segmentId}`,
    duration_seconds: 180,
  };
}

class MemoryStorage {
  private value: string | null = null;

  getItem() {
    return this.value;
  }

  setItem(_key: string, value: string) {
    this.value = value;
  }

  rawValue(): string {
    return this.value ?? "";
  }

  setRawValue(value: string) {
    this.value = value;
  }
}

function storedEntries(
  storage: MemoryStorage,
): Array<{ tripId: number; segmentId: number; signature: string }> {
  const parsed = JSON.parse(storage.rawValue()) as {
    entries: Record<
      string,
      { tripId: number; segmentId: number; signature: string }
    >;
  };

  return Object.values(parsed.entries).map((entry) => ({
    tripId: entry.tripId,
    segmentId: entry.segmentId,
    signature: entry.signature,
  }));
}
