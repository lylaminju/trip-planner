import { afterEach, describe, expect, it, vi } from "vitest";

import { TRANSIT_BUCKET_NOW } from "@/lib/transit-departure";

// The cache holds two row shapes on one key space: full rows written by the
// map and duration-only rows written by duration probes. These tests pin the
// policy that keeps them from corrupting each other: a duration-only row is a
// hit for duration callers but a miss for the full-geometry path.

const CACHED_DURATION_ONLY_ROW = {
  status: "ok",
  encoded_polyline: null,
  duration_seconds: 315,
};

const COMPUTED_FULL_GEOMETRY = {
  status: "ok",
  encoded_polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
  duration_seconds: 540,
};

const SEGMENT_JOIN_ROW = {
  id: 5,
  mode: "walking",
  trip: null,
  from_item: {
    visit_date: null,
    visit_time: null,
    place: { latitude: 40, longitude: -74 },
  },
  to_item: {
    place: { latitude: 40.1, longitude: -73.9 },
  },
};

const WALKING_ROUTE = {
  mode: "walking" as const,
  from_latitude: 40,
  from_longitude: -74,
  to_latitude: 40.1,
  to_longitude: -73.9,
  departure: { bucket: TRANSIT_BUCKET_NOW, departureTime: null },
};

type CacheRow = {
  status: string;
  encoded_polyline: string | null;
  duration_seconds: number | null;
};

function createRouteCacheClient(cachedRow: CacheRow | null) {
  const upserts: Record<string, unknown>[] = [];
  const cacheChain = {
    select: () => cacheChain,
    eq: () => cacheChain,
    gte: () => cacheChain,
    maybeSingle: async () => ({ data: cachedRow, error: null }),
  };
  const segmentChain = {
    select: () => segmentChain,
    eq: () => segmentChain,
    maybeSingle: async () => ({ data: SEGMENT_JOIN_ROW, error: null }),
  };
  const client = {
    from: (table: string) =>
      table === "route_segments"
        ? segmentChain
        : {
            ...cacheChain,
            upsert: async (row: Record<string, unknown>) => {
              upserts.push(row);
              return { error: null };
            },
          },
  };
  return { client, upserts };
}

async function importService(client: unknown) {
  vi.resetModules();
  vi.doMock("@/server/supabase", () => ({
    getSupabaseClient: () => client,
  }));
  vi.doMock("@/server/google-routes", () => ({
    computeGoogleRoute: computeGoogleRouteMock,
  }));
  vi.doMock("@/server/supabase-google-routes-usage-store", () => ({
    assertGoogleRoutesQuota: vi.fn(),
    recordGoogleRoutesCall: vi.fn().mockResolvedValue(undefined),
  }));
  return import("@/server/supabase-route-geometry-service");
}

let computeGoogleRouteMock = vi.fn();

afterEach(() => {
  vi.doUnmock("@/server/supabase");
  vi.doUnmock("@/server/google-routes");
  vi.doUnmock("@/server/supabase-google-routes-usage-store");
  vi.resetModules();
});

describe("supabase-route-geometry-service cache policy", () => {
  // If a duration-only row satisfied the map, the segment would render as
  // no_route (or a straight line) forever and the real path would never be
  // fetched. It must be a miss that triggers the full fetch, whose upsert
  // then completes the same row.
  it("treats a duration-only row as a miss for full geometry and upgrades it", async () => {
    computeGoogleRouteMock = vi.fn().mockResolvedValue(COMPUTED_FULL_GEOMETRY);
    const { client, upserts } = createRouteCacheClient(
      CACHED_DURATION_ONLY_ROW,
    );
    const service = await importService(client);

    await expect(service.getRouteGeometry(1, 5, "test-key")).resolves.toEqual({
      segment_id: 5,
      ...COMPUTED_FULL_GEOMETRY,
    });
    expect(computeGoogleRouteMock).toHaveBeenCalledTimes(1);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      encoded_polyline: COMPUTED_FULL_GEOMETRY.encoded_polyline,
      duration_seconds: COMPUTED_FULL_GEOMETRY.duration_seconds,
    });
  });

  it("serves duration callers from a duration-only row", async () => {
    computeGoogleRouteMock = vi.fn();
    const { client } = createRouteCacheClient(CACHED_DURATION_ONLY_ROW);
    const service = await importService(client);

    await expect(
      service.cachedRouteDurationSeconds(WALKING_ROUTE),
    ).resolves.toEqual({ durationSeconds: 315 });
    expect(computeGoogleRouteMock).not.toHaveBeenCalled();
  });

  it("reports a cached no_route as a definitive null duration", async () => {
    computeGoogleRouteMock = vi.fn();
    const { client } = createRouteCacheClient({
      status: "no_route",
      encoded_polyline: null,
      duration_seconds: null,
    });
    const service = await importService(client);

    await expect(
      service.cachedRouteDurationSeconds(WALKING_ROUTE),
    ).resolves.toEqual({ durationSeconds: null });
  });

  it("writes a duration-only row without a polyline", async () => {
    computeGoogleRouteMock = vi.fn();
    const { client, upserts } = createRouteCacheClient(null);
    const service = await importService(client);

    await service.saveRouteDurationSeconds(WALKING_ROUTE, {
      status: "ok",
      duration_seconds: 315,
    });

    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      mode: "walking",
      encoded_polyline: null,
      duration_seconds: 315,
    });
  });
});
