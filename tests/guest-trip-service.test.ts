import { describe, expect, it, vi } from "vitest";

import {
  exceedsGuestTripLength,
  GUEST_TRIP_MAX_DAYS,
  tripLengthInDays,
} from "@/lib/guest-mode";

const GUEST_ID = "8e7a1c0e-1111-4222-8333-444455556666";

describe("guest trip length rules", () => {
  it.each([
    ["one day", "2026-08-01", "2026-08-01", 1],
    ["exactly the cap", "2026-08-01", "2026-08-05", GUEST_TRIP_MAX_DAYS],
    ["missing end date", "2026-08-01", null, null],
  ])("counts inclusive days: %s", (_label, start, end, expected) => {
    expect(tripLengthInDays(start, end)).toBe(expected);
  });

  it("allows trips up to the cap and rejects longer ones", () => {
    expect(exceedsGuestTripLength("2026-08-01", "2026-08-05")).toBe(false);
    expect(exceedsGuestTripLength("2026-08-01", "2026-08-06")).toBe(true);
    // Undated trips are allowed; the cap applies once dates exist.
    expect(exceedsGuestTripLength(null, null)).toBe(false);
  });
});

describe("createGuestTrip", () => {
  async function loadWithInsertCapture(inserted: Record<string, unknown>[]) {
    vi.resetModules();
    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => ({
        from: () => ({
          insert: (row: Record<string, unknown>) => {
            inserted.push(row);
            return {
              select: () => ({
                single: async () => ({ data: { id: 42 }, error: null }),
              }),
            };
          },
        }),
      }),
    }));
    const { createGuestTrip } = await import("@/server/guest-trip-service");
    return createGuestTrip;
  }

  function unmock() {
    vi.doUnmock("@/server/supabase");
    vi.restoreAllMocks();
    vi.resetModules();
  }

  it("creates a guest-owned ephemeral trip for a curated destination", async () => {
    const inserted: Record<string, unknown>[] = [];
    const createGuestTrip = await loadWithInsertCapture(inserted);

    try {
      const created = await createGuestTrip(GUEST_ID, {
        name: "Seoul demo",
        destination_slug: "seoul",
        start_date: "2026-08-01",
        end_date: "2026-08-05",
      });

      expect(created.tripId).toBe(42);
      expect(inserted[0]).toMatchObject({
        guest_owner_id: GUEST_ID,
        created_by: null,
        destination_slug: "seoul",
      });
      // The TTL is what makes guest trips ephemeral.
      const expiresAt = Date.parse(String(inserted[0].expires_at));
      expect(expiresAt).toBeGreaterThan(Date.now());
    } finally {
      unmock();
    }
  });

  it("rejects destinations outside the curated guest list", async () => {
    const createGuestTrip = await loadWithInsertCapture([]);

    try {
      await expect(
        createGuestTrip(GUEST_ID, {
          name: "Tokyo demo",
          destination_slug: "tokyo",
          start_date: null,
          end_date: null,
        }),
      ).rejects.toThrow("curated destination");
    } finally {
      unmock();
    }
  });

  it("rejects trips longer than the guest cap", async () => {
    const createGuestTrip = await loadWithInsertCapture([]);

    try {
      await expect(
        createGuestTrip(GUEST_ID, {
          name: "Seoul demo",
          destination_slug: "seoul",
          start_date: "2026-08-01",
          end_date: "2026-08-10",
        }),
      ).rejects.toThrow(`${GUEST_TRIP_MAX_DAYS} days`);
    } finally {
      unmock();
    }
  });
});

describe("cloneSampleTripForGuest", () => {
  const SOURCE_TRIP_ID = 56;

  // Rows the sample trip holds, keyed by table. Only the columns the clone
  // reads matter here; the fake echoes back whatever the clone selects.
  const sourceRowsByTable: Record<string, Record<string, unknown>[]> = {
    trips: [{ name: "NYC", destination_slug: "new-york-city" }],
    places: [
      {
        id: 571,
        name: "LaGuardia Airport",
        latitude: 40.7769271,
        longitude: -73.8739659,
        fallback_emoji: "✈️",
        created_by_source: "ai",
      },
    ],
    itinerary_items: [
      {
        id: 900,
        place_id: 571,
        visit_date: "2026-07-28",
        visit_time: "07:19",
        notes: null,
        created_by_source: "ai",
      },
    ],
    route_segments: [],
    trip_transit_points: [],
    trip_lodgings: [],
  };

  // Projects a source row down to the columns the caller actually selected, so
  // a column dropped from a select list shows up as a missing insert value
  // rather than being silently echoed back by the fake.
  function project(
    rows: Record<string, unknown>[],
    columns: string,
  ): Record<string, unknown>[] {
    if (columns.trim() === "*") return rows;
    const wanted = columns.split(",").map((column) => column.trim());
    return rows.map((row) =>
      Object.fromEntries(
        wanted.flatMap((column) =>
          column in row ? [[column, row[column]]] : [],
        ),
      ),
    );
  }

  function fakeSupabase(insertsByTable: Record<string, unknown[]>) {
    return (table: string) => {
      const selectResult = (columns: string) => {
        const rows = project(sourceRowsByTable[table] ?? [], columns);
        return {
          eq: () => ({
            order: async () => ({ data: rows, error: null }),
            is: () => ({ single: async () => ({ data: rows[0], error: null }) }),
            then: (resolve: (value: unknown) => unknown) =>
              resolve({ data: rows, error: null }),
          }),
          in: async () => ({ data: [], error: null }),
        };
      };
      return {
        select: (columns = "*") => selectResult(columns),
        insert: (payload: unknown) => {
          const list = Array.isArray(payload) ? payload : [payload];
          (insertsByTable[table] ??= []).push(...list);
          return {
            select: () => ({
              single: async () => ({ data: { id: 42 }, error: null }),
              then: (resolve: (value: unknown) => unknown) =>
                resolve({
                  data: list.map((_row, index) => ({ id: 1000 + index })),
                  error: null,
                }),
            }),
            then: (resolve: (value: unknown) => unknown) =>
              resolve({ data: null, error: null }),
          };
        },
      };
    };
  }

  // Regeneration only sweeps rows tagged created_by_source = 'ai'
  // (deletePreviousAiBatch). If the clone dropped the tag, a guest's first
  // regeneration would leave the sample itinerary in place and stack a second
  // one beside it, duplicating every anchor and overlapping place.
  it("carries the sample's ai tag and fallback emoji into the clone", async () => {
    const insertsByTable: Record<string, unknown[]> = {};
    vi.resetModules();
    vi.stubEnv("GUEST_SAMPLE_TRIP_ID", String(SOURCE_TRIP_ID));
    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => ({ from: fakeSupabase(insertsByTable) }),
    }));

    try {
      const { cloneSampleTripForGuest } = await import(
        "@/server/guest-trip-service"
      );
      await cloneSampleTripForGuest(GUEST_ID);

      expect(insertsByTable.places?.[0]).toMatchObject({
        created_by_source: "ai",
        fallback_emoji: "✈️",
      });
      expect(insertsByTable.itinerary_items?.[0]).toMatchObject({
        created_by_source: "ai",
      });
      // The source generation belongs to the sample trip, so the clone must not
      // point at it; null is the shape deletePreviousAiBatch sweeps.
      expect(insertsByTable.places?.[0]).not.toHaveProperty("ai_generation_id");
    } finally {
      vi.unstubAllEnvs();
      vi.doUnmock("@/server/supabase");
      vi.resetModules();
    }
  });
});
