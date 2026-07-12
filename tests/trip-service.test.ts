import { describe, expect, it, vi } from "vitest";

describe("trip-service", () => {
  it("persists destination slugs when creating trips", async () => {
    const insertedTrips: Record<string, unknown>[] = [];
    const selectedFields: string[] = [];
    vi.resetModules();
    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => tripCreateClient(insertedTrips, selectedFields),
    }));

    try {
      const { createTripForRequest } = await import("@/server/trip-service");

      const trip = await createTripForRequest("user-1", {
        name: "Toronto June",
        destination: "Toronto",
        destination_slug: "toronto",
        start_date: "2026-06-01",
        end_date: "2026-06-02",
      });

      expect(insertedTrips[0]).toMatchObject({
        destination: "Toronto",
        destination_slug: "toronto",
      });
      expect(selectedFields[0]).toContain("destination_slug");
      expect(trip.destination_slug).toBe("toronto");
    } finally {
      vi.doUnmock("@/server/supabase");
      vi.restoreAllMocks();
      vi.resetModules();
    }
  });

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

  it("soft-deletes trips instead of removing the row", async () => {
    const updates: Record<string, unknown>[] = [];
    let deleteCalled = false;
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
      getSupabaseClient: () =>
        tripDeleteClient(updates, () => {
          deleteCalled = true;
        }),
    }));

    try {
      const { deleteTripForRequest } = await import("@/server/trip-service");

      await deleteTripForRequest(1, "user-1");

      expect(deleteCalled).toBe(false);
      expect(updates).toHaveLength(1);
      expect(updates[0]).toHaveProperty("deleted_at");
      expect(typeof updates[0].deleted_at).toBe("string");
    } finally {
      vi.doUnmock("@/server/trip-access");
      vi.doUnmock("@/server/supabase");
      vi.restoreAllMocks();
      vi.resetModules();
    }
  });
});

function tripDeleteClient(
  updates: Record<string, unknown>[],
  onDelete: () => void,
) {
  return {
    from(table: string) {
      if (table !== "trips") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        update(input: Record<string, unknown>) {
          updates.push(input);
          return {
            eq() {
              return {
                async is() {
                  return { error: null };
                },
              };
            },
          };
        },
        delete() {
          onDelete();
          return {
            async eq() {
              return { error: null };
            },
          };
        },
      };
    },
  };
}

function tripCreateClient(
  insertedTrips: Record<string, unknown>[],
  selectedFields: string[],
) {
  return {
    from(table: string) {
      if (table === "trip_memberships") {
        return {
          async insert(_input: Record<string, unknown>) {
            return { error: null };
          },
        };
      }

      if (table !== "trips") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        insert(input: Record<string, unknown>) {
          insertedTrips.push(input);
          const tripRow = {
            id: 2,
            ...input,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          };

          return {
            select(fields: string) {
              selectedFields.push(fields);
              return {
                async single() {
                  return { data: tripRow, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

function tripClient() {
  const storedTrip = {
    id: 1,
    created_by: "user-1",
    name: "New York City",
    destination: "New York City",
    destination_slug: "new-york-city",
    start_date: "2026-05-27",
    end_date: "2026-05-29",
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
                is() {
                  return {
                    async single() {
                      return { data: storedTrip, error: null };
                    },
                  };
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
