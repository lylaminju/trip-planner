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
