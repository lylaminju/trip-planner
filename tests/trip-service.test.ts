import { describe, expect, it, vi } from "vitest";

describe("trip-service", () => {
  it("rejects partial date updates that would invert the stored trip range", async () => {
    vi.resetModules();
    vi.doMock("@/server/trip-access", () => ({
      requireTripRole: vi.fn().mockResolvedValue({
        trip_id: 1,
        user_id: "user-1",
        role: "owner",
        created_at: "2026-01-01T00:00:00.000Z",
      }),
    }));
    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => tripClient(),
    }));

    try {
      const { updateTripForRequest } = await import("@/server/trip-service");

      await expect(
        updateTripForRequest(1, "user-1", { start_date: "2026-05-30" }),
      ).rejects.toThrow("Trip start date must be before or equal to end date.");
    } finally {
      vi.doUnmock("@/server/trip-access");
      vi.doUnmock("@/server/supabase");
      vi.restoreAllMocks();
      vi.resetModules();
    }
  });
});

function tripClient() {
  const storedTrip = {
    id: 1,
    created_by: "user-1",
    name: "New York City",
    destination: "New York City",
    start_date: "2026-05-27",
    end_date: "2026-05-29",
    timezone: "America/Toronto",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  return {
    from(table: string) {
      if (table !== "trips") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select() {
          return {
            eq() {
              return {
                async single() {
                  return { data: storedTrip, error: null };
                },
              };
            },
          };
        },
        update(input: Partial<typeof storedTrip>) {
          return {
            eq() {
              return {
                select() {
                  return {
                    async single() {
                      const nextTrip = { ...storedTrip, ...input };
                      if (
                        nextTrip.start_date &&
                        nextTrip.end_date &&
                        nextTrip.start_date > nextTrip.end_date
                      ) {
                        return {
                          data: null,
                          error: {
                            message:
                              'violates check constraint "trips_date_range_valid"',
                          },
                        };
                      }

                      return { data: nextTrip, error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}
