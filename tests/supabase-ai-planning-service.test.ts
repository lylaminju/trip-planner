import { afterEach, describe, expect, it, vi } from "vitest";

describe("supabase ai planning service", () => {
  afterEach(() => {
    vi.doUnmock("@/server/supabase");
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("lists destination candidates by sort order and handles an empty catalog", async () => {
    const { client, calls } = createMockSupabaseClient({
      ai_destination_candidates: [],
    });

    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => client,
    }));

    const service = await import("@/server/supabase-ai-planning-service");

    await expect(
      service.listDestinationCandidates("new-york-city"),
    ).resolves.toEqual([]);

    expect(calls).toContainEqual({
      table: "ai_destination_candidates",
      method: "eq",
      args: ["destination_slug", "new-york-city"],
    });
    expect(calls).toContainEqual({
      table: "ai_destination_candidates",
      method: "order",
      args: ["sort_order", { ascending: true }],
    });
  });

  it("loads primary lodging and saved preferences for a trip", async () => {
    const lodging = {
      id: 2,
      trip_id: 1,
      name: "Hotel",
      address: "123 Main St",
      latitude: 40.758,
      longitude: -73.9855,
      google_place_id: "google-hotel",
      check_in_date: null,
      check_out_date: null,
      is_primary: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const preferences = {
      trip_id: 1,
      visits_per_day_min: 2,
      visits_per_day_max: 3,
      interest_tags: ["landmarks"],
      preferred_travel_modes: ["walking", "transit"],
      must_see_candidate_ids: [10],
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const { client, calls } = createMockSupabaseClient({
      trip_lodgings: lodging,
      ai_planning_preferences: preferences,
    });

    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => client,
    }));

    const service = await import("@/server/supabase-ai-planning-service");

    await expect(service.getPrimaryLodging(1)).resolves.toEqual(lodging);
    await expect(service.getPlanningPreferences(1)).resolves.toEqual(
      preferences,
    );

    expect(calls).toContainEqual({
      table: "trip_lodgings",
      method: "eq",
      args: ["is_primary", true],
    });
    expect(calls).toContainEqual({
      table: "ai_planning_preferences",
      method: "maybeSingle",
      args: [],
    });
  });

  it("upserts AI planning preferences for a trip", async () => {
    const preferences = {
      trip_id: 1,
      visits_per_day_min: 1,
      visits_per_day_max: 3,
      interest_tags: ["nature"],
      preferred_travel_modes: ["walking", "transit"],
      must_see_candidate_ids: [10],
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const { client, calls } = createMockSupabaseClient({
      ai_planning_preferences: preferences,
    });

    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => client,
    }));

    const service = await import("@/server/supabase-ai-planning-service");

    await expect(
      service.upsertPlanningPreferences(1, {
        visits_per_day_min: 1,
        visits_per_day_max: 3,
        interest_tags: ["nature"],
        preferred_travel_modes: ["walking", "transit"],
        must_see_candidate_ids: [10],
      }),
    ).resolves.toEqual(preferences);

    expect(calls).toContainEqual({
      table: "ai_planning_preferences",
      method: "upsert",
      args: [
        {
          trip_id: 1,
          visits_per_day_min: 1,
          visits_per_day_max: 3,
          interest_tags: ["nature"],
          preferred_travel_modes: ["walking", "transit"],
          must_see_candidate_ids: [10],
        },
        { onConflict: "trip_id" },
      ],
    });
  });
});

type TableResult = Record<string, unknown> | Record<string, unknown>[] | null;

type QueryCall = {
  table: string;
  method: string;
  args: unknown[];
};

function createMockSupabaseClient(resultsByTable: Record<string, TableResult>) {
  const calls: QueryCall[] = [];

  class QueryBuilder {
    constructor(private readonly table: string) {}

    select(fields: string) {
      calls.push({ table: this.table, method: "select", args: [fields] });
      return this;
    }

    eq(column: string, value: unknown) {
      calls.push({ table: this.table, method: "eq", args: [column, value] });
      return this;
    }

    order(column: string, options: Record<string, unknown>) {
      calls.push({ table: this.table, method: "order", args: [column, options] });
      return this;
    }

    upsert(payload: Record<string, unknown>, options: Record<string, unknown>) {
      calls.push({
        table: this.table,
        method: "upsert",
        args: [payload, options],
      });
      return this;
    }

    maybeSingle() {
      calls.push({ table: this.table, method: "maybeSingle", args: [] });
      return Promise.resolve({
        data: singleResult(resultsByTable[this.table]),
        error: null,
      });
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?:
        | ((value: unknown) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null,
    ) {
      return Promise.resolve({
        data: arrayResult(resultsByTable[this.table]),
        error: null,
      }).then(onfulfilled, onrejected);
    }
  }

  return {
    calls,
    client: {
      from: vi.fn((table: string) => new QueryBuilder(table)),
    },
  };
}

function arrayResult(result: TableResult): Record<string, unknown>[] {
  if (Array.isArray(result)) return result;
  if (!result) return [];
  return [result];
}

function singleResult(result: TableResult): Record<string, unknown> | null {
  if (Array.isArray(result)) return result[0] ?? null;
  return result;
}
