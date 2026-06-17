import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlaceCreateInput } from "@/server/place-inputs";

const baseInput: PlaceCreateInput = {
  name: "Museum",
  address: "123 Main St",
  google_maps_url: "https://www.google.com/maps",
  place_id: null,
  google_place_token: null,
  google_internal_ids: null,
  source_list_url: null,
  latitude: 40.7128,
  longitude: -74.006,
  visit_date: "2026-06-01",
  visit_time: "09:00",
  itinerary_notes: null,
  notes: null,
  links: [],
};

describe("supabase place service route reconciliation", () => {
  afterEach(() => {
    vi.doUnmock("@/server/supabase");
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("runs route reconciliation through the database RPC after planner mutations", async () => {
    const { client, calls } = createMockSupabaseClient();

    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => client,
    }));

    const service = await import("@/server/supabase-place-service");
    await service.createPlace(1, baseInput);

    expect(client.rpc).toHaveBeenCalledWith(
      "reconcile_route_segments_for_trip",
      { p_trip_id: 1 },
    );
    expect(
      calls.filter(
        (call) =>
          call.table === "route_segments" &&
          (call.method === "insert" || call.method === "delete"),
      ),
    ).toEqual([]);
  });
});

type QueryCall = {
  table: string;
  method: string;
};

function createMockSupabaseClient() {
  const calls: QueryCall[] = [];
  const place = {
    id: 1,
    trip_id: 1,
    name: baseInput.name,
    address: baseInput.address,
    google_maps_url: baseInput.google_maps_url,
    place_id: baseInput.place_id,
    google_place_token: baseInput.google_place_token,
    google_internal_ids: baseInput.google_internal_ids,
    source_list_url: baseInput.source_list_url,
    latitude: baseInput.latitude,
    longitude: baseInput.longitude,
    notes: baseInput.notes,
    links: baseInput.links,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const itineraryItem = {
    id: 1,
    trip_id: 1,
    place_id: 1,
    visit_date: baseInput.visit_date,
    visit_time: baseInput.visit_time,
    notes: baseInput.itinerary_notes,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    place,
  };
  const routeSegments: unknown[] = [];

  class QueryBuilder {
    private operation: string | null = null;

    constructor(private readonly table: string) {}

    insert() {
      this.operation = "insert";
      calls.push({ table: this.table, method: "insert" });
      return this;
    }

    delete() {
      this.operation = "delete";
      calls.push({ table: this.table, method: "delete" });
      return this;
    }

    select() {
      calls.push({ table: this.table, method: "select" });
      return this;
    }

    eq() {
      return this;
    }

    order() {
      return this;
    }

    single() {
      return Promise.resolve({
        data: this.table === "places" ? place : itineraryItem,
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
      return Promise.resolve(this.result()).then(onfulfilled, onrejected);
    }

    private result() {
      if (this.operation === "delete") {
        return { error: null, count: 1 };
      }

      if (this.table === "places") {
        return { data: [place], error: null };
      }

      if (this.table === "itinerary_items") {
        return { data: [itineraryItem], error: null };
      }

      return { data: routeSegments, error: null };
    }
  }

  return {
    calls,
    client: {
      from: vi.fn((table: string) => new QueryBuilder(table)),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
}
