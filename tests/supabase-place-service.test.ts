import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ItineraryItemUpdate,
  PlaceCreateInput,
  PlaceEditInput,
} from "@/server/place-inputs";

const baseInput: PlaceCreateInput = {
  name: "Museum",
  address: "123 Main St",
  google_maps_url: "https://www.google.com/maps",
  google_place_id: null,
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

describe("supabase place service planner mutations", () => {
  afterEach(() => {
    vi.doUnmock("@/server/supabase");
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it.each([
    {
      name: "createPlace",
      run: (service: SupabasePlaceService) => service.createPlace(1, baseInput),
    },
    {
      name: "editPlace",
      run: (service: SupabasePlaceService) =>
        service.editPlace(1, 1, {
          name: "Updated museum",
          visit_date: "2026-06-02",
        } satisfies PlaceEditInput),
    },
    {
      name: "removePlace",
      run: (service: SupabasePlaceService) => service.removePlace(1, 1),
    },
    {
      name: "schedulePlace",
      run: (service: SupabasePlaceService) =>
        service.schedulePlace(1, 1, "2026-06-02", "10:30"),
    },
    {
      name: "scheduleItineraryItem",
      run: (service: SupabasePlaceService) =>
        service.scheduleItineraryItem(1, 1, "2026-06-02", "10:30"),
    },
    {
      name: "editItineraryItem",
      run: (service: SupabasePlaceService) =>
        service.editItineraryItem(1, 1, {
          visit_time: "10:30",
        } satisfies ItineraryItemUpdate),
    },
    {
      name: "removeItineraryItem",
      run: (service: SupabasePlaceService) =>
        service.removeItineraryItem(1, 1),
    },
  ])(
    "runs route reconciliation through the database RPC after $name",
    async ({ run }) => {
      const { client, calls } = createMockSupabaseClient();
      const service = await importService(client);

      await run(service);

      expect(client.rpc).toHaveBeenCalledTimes(1);
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
      expect(selectTablesAfterReconciliation(calls)).toEqual([
        "places",
        "itinerary_items",
        "route_segments",
      ]);
    },
  );

  it("updates a route segment mode without reconciling route segment order", async () => {
    const { client, calls } = createMockSupabaseClient();
    const service = await importService(client);

    await service.setRouteSegmentMode(1, 1, "walking");

    expect(client.rpc).not.toHaveBeenCalled();
    expect(calls).toContainEqual({
      table: "route_segments",
      method: "update",
    });
    expect(selectTables(calls)).toEqual(
      expect.arrayContaining(["places", "itinerary_items", "route_segments"]),
    );
  });
});

type SupabasePlaceService = typeof import("@/server/supabase-place-service");

type QueryCall = {
  table: string;
  method: string;
};

async function importService(
  client: ReturnType<typeof createMockSupabaseClient>["client"],
) {
  vi.doMock("@/server/supabase", () => ({
    getSupabaseClient: () => client,
  }));

  return import("@/server/supabase-place-service");
}

function createMockSupabaseClient() {
  const calls: QueryCall[] = [];
  const place = {
    id: 1,
    trip_id: 1,
    name: baseInput.name,
    address: baseInput.address,
    google_maps_url: baseInput.google_maps_url,
    google_place_id: baseInput.google_place_id,
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
  const routeSegment = {
    id: 1,
    trip_id: 1,
    from_item_id: 1,
    to_item_id: 2,
    mode: "walking",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const routeSegments: unknown[] = [routeSegment];

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

    update() {
      this.operation = "update";
      calls.push({ table: this.table, method: "update" });
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

    maybeSingle() {
      return Promise.resolve({
        data: this.singleRow(),
        error: null,
      });
    }

    single() {
      return Promise.resolve({
        data: this.singleRow(),
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

    private singleRow() {
      if (this.table === "places") {
        return place;
      }

      if (this.table === "itinerary_items") {
        return itineraryItem;
      }

      return routeSegment;
    }
  }

  return {
    calls,
    client: {
      from: vi.fn((table: string) => new QueryBuilder(table)),
      rpc: vi.fn().mockImplementation((method: string) => {
        calls.push({ table: "rpc", method });
        return Promise.resolve({ data: null, error: null });
      }),
    },
  };
}

function selectTablesAfterReconciliation(calls: QueryCall[]): string[] {
  const rpcIndex = calls.findIndex(
    (call) =>
      call.table === "rpc" &&
      call.method === "reconcile_route_segments_for_trip",
  );
  return selectTables(calls.slice(rpcIndex + 1));
}

function selectTables(calls: QueryCall[]): string[] {
  return calls
    .filter((call) => call.method === "select")
    .map((call) => call.table);
}
