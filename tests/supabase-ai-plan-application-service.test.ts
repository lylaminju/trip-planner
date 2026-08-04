import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AiDestinationCandidate,
  TripLodging,
  TripTransitPoint,
  TripTransitPointKind,
} from "@/lib/types";
import type { AiItineraryPlan } from "@/server/openai-ai-planner";

describe("supabase AI plan application service", () => {
  afterEach(() => {
    vi.doUnmock("@/server/supabase");
    vi.doUnmock("@/server/supabase-place-service");
    vi.doUnmock("@/server/route-geometry-service");
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("probes only short generated segments before choosing walking", async () => {
    const { client, updateCalls } = createMockSupabaseClient();
    const getRouteGeometry = vi.fn().mockResolvedValue({
      segment_id: 301,
      status: "ok",
      duration_seconds: 18 * 60,
    });

    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => client,
    }));
    vi.doMock("@/server/supabase-place-service", () => ({
      getPlannerSnapshot: vi.fn().mockResolvedValue({
        places: [],
        itineraryItems: [],
        routeSegments: [],
      }),
    }));
    vi.doMock("@/server/route-geometry-service", () => ({
      getRouteGeometry,
      getRouteDurationSeconds: vi.fn().mockResolvedValue(null),
    }));

    const service = await import("@/server/supabase-ai-plan-application-service");

    await service.replaceAiGeneratedBatch(
      1,
      55,
      plan(),
      candidates(),
      {
        visits_per_day_min: 1,
        visits_per_day_max: 3,
        interest_tags: [],
        avoid_interest_tags: [],
        preferred_travel_modes: ["walking", "transit"],
        must_see_candidate_ids: [],
        daily_start_time: "09:00",
      },
    );

    expect(getRouteGeometry).toHaveBeenCalledTimes(1);
    expect(getRouteGeometry).toHaveBeenCalledWith(1, 301, undefined);
    expect(updateCalls).toEqual([
      expect.objectContaining({
        filters: [
          ["trip_id", 1],
          ["id", 301],
        ],
        payload: expect.objectContaining({
          ai_generation_id: 55,
          created_by_source: "ai",
          mode: "walking",
        }),
      }),
      expect.objectContaining({
        filters: [
          ["trip_id", 1],
          ["id", 302],
        ],
        payload: expect.objectContaining({
          ai_generation_id: 55,
          created_by_source: "ai",
          mode: "transit",
        }),
      }),
    ]);
  });

  it("does not delete the previous AI batch when staging a replacement fails", async () => {
    const { client, deleteCalls } = createMockSupabaseClient({
      failItineraryItemInsert: true,
    });

    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => client,
    }));
    vi.doMock("@/server/supabase-place-service", () => ({
      getPlannerSnapshot: vi.fn(),
    }));
    vi.doMock("@/server/route-geometry-service", () => ({
      getRouteGeometry: vi.fn(),
      getRouteDurationSeconds: vi.fn().mockResolvedValue(null),
    }));

    const service = await import("@/server/supabase-ai-plan-application-service");

    await expect(
      service.replaceAiGeneratedBatch(1, 55, plan(), candidates(), {
        visits_per_day_min: 1,
        visits_per_day_max: 3,
        interest_tags: [],
        avoid_interest_tags: [],
        preferred_travel_modes: ["walking", "transit"],
        must_see_candidate_ids: [],
        daily_start_time: "09:00",
      }),
    ).rejects.toThrow("Supabase query failed: itinerary insert failed");

    expect(
      deleteCalls.filter((call) => !hasFilter(call, "ai_generation_id", 55)),
    ).toEqual([]);
  });

  it("materializes lodging as the first generated itinerary item for each day", async () => {
    const { client, insertCalls } = createMockSupabaseClient();

    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => client,
    }));
    vi.doMock("@/server/supabase-place-service", () => ({
      getPlannerSnapshot: vi.fn().mockResolvedValue({
        places: [],
        itineraryItems: [],
        routeSegments: [],
      }),
    }));
    vi.doMock("@/server/route-geometry-service", () => ({
      getRouteGeometry: vi.fn(),
      getRouteDurationSeconds: vi.fn().mockResolvedValue(null),
    }));

    const service = await import("@/server/supabase-ai-plan-application-service");
    const replaceAiGeneratedBatch =
      service.replaceAiGeneratedBatch as unknown as (
        ...args: unknown[]
      ) => Promise<unknown>;

    await replaceAiGeneratedBatch(
      1,
      55,
      twoDayPlan(),
      candidates(),
      {
        visits_per_day_min: 1,
        visits_per_day_max: 3,
        interest_tags: [],
        avoid_interest_tags: [],
        preferred_travel_modes: ["walking", "transit"],
        must_see_candidate_ids: [],
        daily_start_time: "09:00",
      },
      lodging(),
      "08:30",
    );

    const placeRows = insertedRows(insertCalls, "places");
    expect(placeRows).toEqual([
      expect.objectContaining({
        trip_id: 1,
        name: "Pod Times Square",
        address: null,
        google_maps_url:
          "https://www.google.com/maps/place/?q=place_id%3Agoogle-pod",
        latitude: 40.758,
        longitude: -73.993,
        created_by_source: "ai",
        ai_generation_id: 55,
      }),
      expect.objectContaining({ name: "Candidate 10" }),
      expect.objectContaining({ name: "Candidate 11" }),
    ]);

    expect(insertedRows(insertCalls, "itinerary_items")).toEqual([
      expect.objectContaining({
        trip_id: 1,
        place_id: 101,
        visit_date: "2026-05-27",
        visit_time: "08:30",
        created_by_source: "ai",
        ai_generation_id: 55,
      }),
      expect.objectContaining({
        trip_id: 1,
        place_id: 102,
        visit_date: "2026-05-27",
        visit_time: "09:00",
      }),
      expect.objectContaining({
        trip_id: 1,
        place_id: 101,
        visit_date: "2026-05-28",
        visit_time: "08:30",
      }),
      expect.objectContaining({
        trip_id: 1,
        place_id: 103,
        visit_date: "2026-05-28",
        visit_time: "10:00",
      }),
    ]);
  });

  it("writes one place for a round trip that departs from the arrival stop", async () => {
    const { client, insertCalls } = createMockSupabaseClient();

    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => client,
    }));
    vi.doMock("@/server/supabase-place-service", () => ({
      getPlannerSnapshot: vi.fn().mockResolvedValue({
        places: [],
        itineraryItems: [],
        routeSegments: [],
      }),
    }));
    vi.doMock("@/server/route-geometry-service", () => ({
      getRouteGeometry: vi.fn(),
      getRouteDurationSeconds: vi.fn().mockResolvedValue(null),
    }));

    const service = await import("@/server/supabase-ai-plan-application-service");
    const replaceAiGeneratedBatch =
      service.replaceAiGeneratedBatch as unknown as (
        ...args: unknown[]
      ) => Promise<unknown>;

    await replaceAiGeneratedBatch(
      1,
      55,
      twoDayPlan(),
      candidates(),
      {
        visits_per_day_min: 1,
        visits_per_day_max: 3,
        interest_tags: [],
        avoid_interest_tags: [],
        preferred_travel_modes: ["walking", "transit"],
        must_see_candidate_ids: [],
        daily_start_time: "09:00",
      },
      null,
      "09:00",
      undefined,
      airportPoint("arrival", "08:00"),
      airportPoint("departure", "18:00"),
    );

    expect(insertedRows(insertCalls, "places")).toEqual([
      expect.objectContaining({ name: "LaGuardia Airport" }),
      expect.objectContaining({ name: "Candidate 10" }),
      expect.objectContaining({ name: "Candidate 11" }),
    ]);

    // Both anchor visits point at the single airport place, so the places list
    // shows the airport once.
    expect(insertedRows(insertCalls, "itinerary_items")).toEqual([
      expect.objectContaining({
        place_id: 101,
        visit_date: "2026-05-27",
        visit_time: "08:00",
      }),
      expect.objectContaining({
        place_id: 102,
        visit_date: "2026-05-27",
        visit_time: "09:00",
      }),
      expect.objectContaining({
        place_id: 103,
        visit_date: "2026-05-28",
        visit_time: "10:00",
      }),
      expect.objectContaining({
        place_id: 101,
        visit_date: "2026-05-28",
        visit_time: "18:00",
      }),
    ]);
  });

  it("schedules each day's first attraction after the lodging route duration", async () => {
    const { client, insertCalls } = createMockSupabaseClient();
    const getRouteDurationSeconds = vi
      .fn()
      .mockResolvedValueOnce(18 * 60)
      .mockResolvedValueOnce(22 * 60);
    const getRouteGeometry = vi.fn();

    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => client,
    }));
    vi.doMock("@/server/supabase-place-service", () => ({
      getPlannerSnapshot: vi.fn().mockResolvedValue({
        places: [],
        itineraryItems: [],
        routeSegments: [],
      }),
    }));
    vi.doMock("@/server/route-geometry-service", () => ({
      getRouteGeometry,
      getRouteDurationSeconds,
    }));

    const service = await import("@/server/supabase-ai-plan-application-service");
    const replaceAiGeneratedBatch =
      service.replaceAiGeneratedBatch as unknown as (
        ...args: unknown[]
      ) => Promise<unknown>;

    await replaceAiGeneratedBatch(
      1,
      55,
      twoDayLodgingStartPlan(),
      candidates(),
      {
        visits_per_day_min: 1,
        visits_per_day_max: 3,
        interest_tags: [],
        preferred_travel_modes: ["walking"],
        must_see_candidate_ids: [],
      },
      lodging(),
      "09:00",
    );

    expect(getRouteDurationSeconds).toHaveBeenCalledTimes(2);
    expect(getRouteGeometry).not.toHaveBeenCalled();
    expect(insertedRows(insertCalls, "itinerary_items")).toEqual([
      expect.objectContaining({
        place_id: 101,
        visit_date: "2026-05-27",
        visit_time: "09:00",
      }),
      expect.objectContaining({
        place_id: 102,
        visit_date: "2026-05-27",
        visit_time: "09:20",
      }),
      expect.objectContaining({
        place_id: 101,
        visit_date: "2026-05-28",
        visit_time: "09:00",
      }),
      expect.objectContaining({
        place_id: 103,
        visit_date: "2026-05-28",
        visit_time: "09:30",
      }),
    ]);
  });

  it("corrects the first attraction when final route geometry takes longer than the AI time", async () => {
    const { client, insertCalls, updateCalls } = createMockSupabaseClient();
    const getRouteDurationSeconds = vi.fn().mockResolvedValue(null);
    const getRouteGeometry = vi.fn().mockResolvedValue({
      segment_id: 301,
      status: "ok",
      duration_seconds: 35 * 60,
    });

    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => client,
    }));
    vi.doMock("@/server/supabase-place-service", () => ({
      getPlannerSnapshot: vi.fn().mockResolvedValue({
        places: [],
        itineraryItems: [],
        routeSegments: [],
      }),
    }));
    vi.doMock("@/server/route-geometry-service", () => ({
      getRouteGeometry,
      getRouteDurationSeconds,
    }));

    const service = await import("@/server/supabase-ai-plan-application-service");
    const replaceAiGeneratedBatch =
      service.replaceAiGeneratedBatch as unknown as (
        ...args: unknown[]
      ) => Promise<unknown>;

    await replaceAiGeneratedBatch(
      1,
      55,
      oneDayLodgingStartPlan("09:20"),
      brooklynBridgeCandidates(),
      {
        visits_per_day_min: 1,
        visits_per_day_max: 3,
        interest_tags: [],
        avoid_interest_tags: [],
        preferred_travel_modes: ["walking", "transit"],
        must_see_candidate_ids: [],
        daily_start_time: "09:00",
      },
      lodging(),
      "09:00",
    );

    expect(insertedRows(insertCalls, "itinerary_items")).toEqual([
      expect.objectContaining({
        place_id: 101,
        visit_date: "2026-05-27",
        visit_time: "09:00",
      }),
      expect.objectContaining({
        place_id: 102,
        visit_date: "2026-05-27",
        visit_time: "09:20",
      }),
    ]);
    expect(getRouteGeometry).toHaveBeenCalledWith(1, 301, undefined);
    expect(updateCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: "route_segments",
        filters: [
          ["trip_id", 1],
          ["id", 301],
        ],
        payload: expect.objectContaining({
          mode: "transit",
        }),
      }),
      expect.objectContaining({
        table: "itinerary_items",
        filters: [
          ["trip_id", 1],
          ["id", 202],
        ],
        payload: expect.objectContaining({
          visit_time: "09:40",
        }),
      }),
    ]));
  });
});

type QueryResult = {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
};

type UpdateCall = {
  table: string;
  payload: Record<string, unknown>;
  filters: Array<[string, unknown]>;
};

type InsertCall = {
  table: string;
  payload: Record<string, unknown> | Record<string, unknown>[];
};

type DeleteCall = {
  table: string;
  filters: Array<[string, unknown]>;
};

function createMockSupabaseClient(
  options: { failItineraryItemInsert?: boolean } = {},
) {
  const insertCalls: InsertCall[] = [];
  const updateCalls: UpdateCall[] = [];
  const deleteCalls: DeleteCall[] = [];

  class QueryBuilder {
    private operation: "delete" | "insert" | "select" | "update" | null = null;
    private payload: Record<string, unknown> | Record<string, unknown>[] | null =
      null;
    private selectFields = "";
    private readonly filters: Array<[string, unknown]> = [];

    constructor(private readonly table: string) {}

    delete() {
      this.operation = "delete";
      return this;
    }

    insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
      this.operation = "insert";
      this.payload = payload;
      return this;
    }

    update(payload: Record<string, unknown>) {
      this.operation = "update";
      this.payload = payload;
      return this;
    }

    select(fields: string) {
      this.selectFields = fields;
      if (!this.operation) {
        this.operation = "select";
      }
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push([column, value]);
      return this;
    }

    is(column: string, value: unknown) {
      this.filters.push([column, value]);
      return this;
    }

    neq(column: string, value: unknown) {
      this.filters.push([column, value]);
      return this;
    }

    in(column: string, values: unknown[]) {
      this.filters.push([column, values]);
      return this;
    }

    then<TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?:
        | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
    }

    private resolve(): QueryResult {
      if (this.operation === "insert" && this.table === "places") {
        const rows = payloadRows(this.payload);
        insertCalls.push({ table: this.table, payload: rows });
        return {
          data: rows.map((_, index) => ({ id: 101 + index })),
          error: null,
        };
      }

      if (this.operation === "insert" && this.table === "itinerary_items") {
        const rows = payloadRows(this.payload);
        insertCalls.push({ table: this.table, payload: rows });
        if (options.failItineraryItemInsert) {
          return {
            data: null,
            error: { message: "itinerary insert failed" },
          };
        }

        return {
          data: rows.map((_, index) => ({ id: 201 + index })),
          error: null,
        };
      }

      if (this.operation === "select" && this.table === "route_segments") {
        expect(this.selectFields).toBe("id, from_item_id, to_item_id");
        return {
          data: [
            { id: 301, from_item_id: 201, to_item_id: 202 },
            { id: 302, from_item_id: 202, to_item_id: 203 },
          ],
          error: null,
        };
      }

      if (this.operation === "update") {
        updateCalls.push({
          table: this.table,
          payload: this.payload as Record<string, unknown>,
          filters: [...this.filters],
        });
      }

      if (this.operation === "delete") {
        deleteCalls.push({
          table: this.table,
          filters: [...this.filters],
        });
      }

      return { data: null, error: null };
    }
  }

  return {
    deleteCalls,
    insertCalls,
    updateCalls,
    client: {
      from: vi.fn((table: string) => new QueryBuilder(table)),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
}

function payloadRows(
  payload: Record<string, unknown> | Record<string, unknown>[] | null,
): Record<string, unknown>[] {
  if (!payload) return [];
  return Array.isArray(payload) ? payload : [payload];
}

function insertedRows(
  calls: InsertCall[],
  table: string,
): Record<string, unknown>[] {
  const call = calls.find((insertCall) => insertCall.table === table);
  return call ? payloadRows(call.payload) : [];
}

function hasFilter(
  call: { filters: Array<[string, unknown]> },
  column: string,
  value: unknown,
): boolean {
  return call.filters.some(
    ([filterColumn, filterValue]) =>
      filterColumn === column && filterValue === value,
  );
}

function plan(): AiItineraryPlan {
  return {
    days: [
      {
        date: "2026-05-27",
        visits: [
          visit(10, "09:00"),
          visit(11, "11:00"),
          visit(12, "13:00"),
        ],
      },
    ],
  };
}

function twoDayPlan(): AiItineraryPlan {
  return {
    days: [
      {
        date: "2026-05-27",
        visits: [visit(10, "09:00")],
      },
      {
        date: "2026-05-28",
        visits: [visit(11, "10:00")],
      },
    ],
  };
}

function twoDayLodgingStartPlan(): AiItineraryPlan {
  return {
    days: [
      {
        date: "2026-05-27",
        visits: [visit(10, "09:00")],
      },
      {
        date: "2026-05-28",
        visits: [visit(11, "09:00")],
      },
    ],
  };
}

function oneDayLodgingStartPlan(startTime = "09:00"): AiItineraryPlan {
  return {
    days: [
      {
        date: "2026-05-27",
        visits: [visit(10, startTime)],
      },
    ],
  };
}

function lodging(): TripLodging {
  return {
    id: 7,
    trip_id: 1,
    name: "Pod Times Square",
    latitude: 40.758,
    longitude: -73.993,
    google_place_id: "google-pod",
    is_primary: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function airportPoint(
  kind: TripTransitPointKind,
  eventTime: string,
): TripTransitPoint {
  return {
    id: kind === "arrival" ? 41 : 42,
    trip_id: 1,
    kind,
    name: "LaGuardia Airport",
    latitude: 40.7769271,
    longitude: -73.8739659,
    google_place_id: null,
    hub_type: "airport",
    event_time: eventTime,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function visit(candidateId: number, startTime: string) {
  return {
    candidate_id: candidateId,
    start_time: startTime,
    duration_minutes: 90,
    notes: null,
  };
}

function candidates(): AiDestinationCandidate[] {
  return [
    candidate(10, 34.1016, -118.3269),
    candidate(11, 34.102, -118.3409),
    candidate(12, 34.134115, -118.321548),
  ];
}

function brooklynBridgeCandidates(): AiDestinationCandidate[] {
  return [candidate(10, 40.7060855, -73.9968643)];
}

function candidate(
  id: number,
  latitude: number,
  longitude: number,
): AiDestinationCandidate {
  return {
    id,
    destination_slug: "los-angeles",
    name: `Candidate ${id}`,
    category: "landmark",
    tags: ["landmarks"],
    area: "Los Angeles",
    region_distance_tier: "central",
    sort_order: id,
    latitude,
    longitude,
    google_place_id: null,
    typical_duration_minutes: 90,
    indoor_outdoor: "mixed",
    planning_note: null,
    blurb: null,
    image_url: null,
    image_credit: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}
