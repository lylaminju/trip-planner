import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiDestinationCandidate } from "@/lib/types";
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
        preferred_travel_modes: ["walking", "transit"],
        must_see_candidate_ids: [],
      },
    );

    expect(getRouteGeometry).toHaveBeenCalledTimes(1);
    expect(getRouteGeometry).toHaveBeenCalledWith(1, 301);
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
});

type QueryResult = {
  data: Record<string, unknown>[] | null;
  error: null;
};

type UpdateCall = {
  table: string;
  payload: Record<string, unknown>;
  filters: Array<[string, unknown]>;
};

function createMockSupabaseClient() {
  const updateCalls: UpdateCall[] = [];

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
        return {
          data: [{ id: 101 }, { id: 102 }, { id: 103 }],
          error: null,
        };
      }

      if (this.operation === "insert" && this.table === "itinerary_items") {
        return {
          data: [{ id: 201 }, { id: 202 }, { id: 203 }],
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

      return { data: null, error: null };
    }
  }

  return {
    updateCalls,
    client: {
      from: vi.fn((table: string) => new QueryBuilder(table)),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
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
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}
