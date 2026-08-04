import { afterEach, describe, expect, it, vi } from "vitest";

describe("supabase ai planning service", () => {
  afterEach(() => {
    vi.doUnmock("@/server/supabase");
    vi.doUnmock("@/server/google-url-resolver");
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
      latitude: 40.758,
      longitude: -73.9855,
      google_place_id: "google-hotel",
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
      daily_start_time: "08:00:00",
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
    await expect(service.getPlanningPreferences(1)).resolves.toEqual({
      ...preferences,
      daily_start_time: "08:00",
    });

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

  it("resolves a lodging Google Maps URL and inserts a primary lodging row", async () => {
    const lodging = {
      id: 2,
      trip_id: 1,
      name: "Pod Times Square",
      latitude: 40.758,
      longitude: -73.993,
      google_place_id: null,
      is_primary: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const { client, calls } = createMockSupabaseClient({
      trip_lodgings: { sequence: [null, lodging] },
    });
    const resolveGoogleMapsUrl = vi.fn().mockResolvedValue({
      google_maps_url: "https://www.google.com/maps/place/Pod",
      name: "Pod Times Square",
      latitude: 40.758,
      longitude: -73.993,
    });

    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => client,
    }));
    vi.doMock("@/server/google-url-resolver", () => ({
      resolveGoogleMapsUrl,
    }));

    const service = await import("@/server/supabase-ai-planning-service");

    await expect(
      service.upsertPrimaryLodgingFromGoogleMapsUrl(
        1,
        "https://maps.app.goo.gl/example",
      ),
    ).resolves.toEqual(lodging);

    expect(resolveGoogleMapsUrl).toHaveBeenCalledWith(
      "https://maps.app.goo.gl/example",
    );
    expect(calls).toContainEqual({
      table: "trip_lodgings",
      method: "insert",
      args: [
        {
          trip_id: 1,
          name: "Pod Times Square",
          latitude: 40.758,
          longitude: -73.993,
          google_place_id: null,
          is_primary: true,
        },
      ],
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
      // Postgres `time` columns read back with seconds; callers expect HH:MM.
      daily_start_time: "08:30:00",
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
        avoid_interest_tags: [],
        preferred_travel_modes: ["walking", "transit"],
        must_see_candidate_ids: [10],
        daily_start_time: "08:30",
        include_lunch_stop: false,
        dining_budget: null,
        dietary_tags: [],
        dietary_notes: null,
      }),
    ).resolves.toEqual({ ...preferences, daily_start_time: "08:30" });

    expect(calls).toContainEqual({
      table: "ai_planning_preferences",
      method: "upsert",
      args: [
        {
          trip_id: 1,
          visits_per_day_min: 1,
          visits_per_day_max: 3,
          interest_tags: ["nature"],
          avoid_interest_tags: [],
          preferred_travel_modes: ["walking", "transit"],
          must_see_candidate_ids: [10],
          daily_start_time: "08:30",
          include_lunch_stop: false,
          dining_budget: null,
          dietary_tags: [],
          dietary_notes: null,
        },
        { onConflict: "trip_id" },
      ],
    });
  });

  it("normalizes transit point event times when listing them", async () => {
    const { client } = createMockSupabaseClient({
      trip_transit_points: [
        {
          id: 3,
          trip_id: 1,
          kind: "arrival",
          name: "JFK Airport",
          latitude: 40.641,
          longitude: -73.778,
          google_place_id: null,
          event_time: "15:30:00",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => client,
    }));

    const service = await import("@/server/supabase-ai-planning-service");
    const points = await service.getTransitPoints(1);

    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ kind: "arrival", event_time: "15:30" });
  });

  it("resolves a transit point Google Maps URL and upserts it by trip and kind", async () => {
    const stored = {
      id: 3,
      trip_id: 1,
      kind: "arrival",
      name: "JFK Airport",
      latitude: 40.641,
      longitude: -73.778,
      google_place_id: null,
      event_time: "15:30:00",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const { client, calls } = createMockSupabaseClient({
      trip_transit_points: stored,
    });
    const resolveGoogleMapsUrl = vi.fn().mockResolvedValue({
      google_maps_url: "https://www.google.com/maps/place/JFK",
      name: "JFK Airport",
      latitude: 40.641,
      longitude: -73.778,
    });

    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => client,
    }));
    vi.doMock("@/server/google-url-resolver", () => ({
      resolveGoogleMapsUrl,
    }));

    const service = await import("@/server/supabase-ai-planning-service");
    const point = await service.upsertTransitPointFromGoogleMapsUrl(
      1,
      "arrival",
      "https://maps.app.goo.gl/jfk",
      "15:30",
    );

    expect(point.event_time).toBe("15:30");
    const upsertCall = calls.find(
      (call) =>
        call.table === "trip_transit_points" && call.method === "upsert",
    );
    expect(upsertCall?.args[0]).toMatchObject({
      trip_id: 1,
      kind: "arrival",
      name: "JFK Airport",
      latitude: 40.641,
      longitude: -73.778,
      event_time: "15:30",
    });
    expect(upsertCall?.args[1]).toEqual({ onConflict: "trip_id,kind" });
  });

  it("rejects transit point URLs that resolve without coordinates", async () => {
    const { client } = createMockSupabaseClient({});
    const resolveGoogleMapsUrl = vi.fn().mockResolvedValue({
      google_maps_url: "https://www.google.com/maps/place/JFK",
      name: "JFK Airport",
      latitude: null,
      longitude: null,
    });

    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => client,
    }));
    vi.doMock("@/server/google-url-resolver", () => ({
      resolveGoogleMapsUrl,
    }));

    const service = await import("@/server/supabase-ai-planning-service");

    await expect(
      service.upsertTransitPointFromGoogleMapsUrl(
        1,
        "departure",
        "https://maps.app.goo.gl/jfk",
        null,
      ),
    ).rejects.toThrow(
      "Departure stop Google Maps URL must include coordinates.",
    );
  });
});

type TableResult = Record<string, unknown> | Record<string, unknown>[] | null;
type TableResultSource = TableResult | { sequence: TableResult[] };

type QueryCall = {
  table: string;
  method: string;
  args: unknown[];
};

function createMockSupabaseClient(
  resultsByTable: Record<string, TableResultSource>,
) {
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

    insert(payload: Record<string, unknown>) {
      calls.push({ table: this.table, method: "insert", args: [payload] });
      return this;
    }

    update(payload: Record<string, unknown>) {
      calls.push({ table: this.table, method: "update", args: [payload] });
      return this;
    }

    maybeSingle() {
      calls.push({ table: this.table, method: "maybeSingle", args: [] });
      return Promise.resolve({
        data: singleResult(nextResult(resultsByTable, this.table)),
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
        data: arrayResult(nextResult(resultsByTable, this.table)),
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

function nextResult(
  resultsByTable: Record<string, TableResultSource>,
  table: string,
): TableResult {
  const source = resultsByTable[table];
  if (isResultSequence(source)) {
    return source.sequence.shift() ?? null;
  }

  return source ?? null;
}

function isResultSequence(
  value: TableResultSource | undefined,
): value is { sequence: TableResult[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "sequence" in value &&
    Array.isArray(value.sequence)
  );
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
