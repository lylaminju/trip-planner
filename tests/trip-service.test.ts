import { describe, expect, it, vi } from "vitest";

describe("trip-service", () => {
  it("persists destination slugs when creating trips", async () => {
    const insertedTrips: Record<string, unknown>[] = [];
    const selectedFields: string[] = [];
    vi.resetModules();
    vi.doMock("@/server/supabase", () => ({
      getSupabaseClient: () => tripCreateClient(insertedTrips, selectedFields),
    }));
    vi.doMock("@/server/trip-members", () => ({
      listTripMembers: vi.fn().mockResolvedValue(new Map()),
    }));

    try {
      const { createTripForRequest } = await import("@/server/trip-service");

      const trip = await createTripForRequest("user-1", {
        name: "Toronto June",
        destination: "Toronto",
        destination_slug: "toronto",
        destination_latitude: null,
        destination_longitude: null,
        destination_country_codes: null,
        destination_photo_data: null,
        destination_photo_attribution: null,
        start_date: "2026-06-01",
        end_date: "2026-06-02",
      });

      // A preset destination arrives with only a slug; creation fills its
      // coordinates and country from the preset so the columns are the source
      // of truth for map focus and place-search scope.
      expect(insertedTrips[0]).toMatchObject({
        destination: "Toronto",
        destination_slug: "toronto",
        destination_latitude: 43.6532,
        destination_longitude: -79.3832,
        destination_country_codes: ["CA"],
      });
      expect(selectedFields[0]).toContain("destination_slug");
      expect(trip.destination_slug).toBe("toronto");
    } finally {
      vi.doUnmock("@/server/supabase");
      vi.doUnmock("@/server/trip-members");
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

  it("commits date changes and the visit shift through one atomic RPC", async () => {
    const recorded = { tripUpdates: [], rpcCalls: [] } as Recorded;
    await withDateShiftClient(recorded, async (updateTripForRequest) => {
      await updateTripForRequest(1, "user-1", {
        start_date: "2027-08-01",
        end_date: "2027-08-07",
      });
    });

    // Date columns must never travel through a plain row update: the trip row
    // and its visit dates have to commit or roll back together.
    expect(recorded.tripUpdates).toEqual([]);
    expect(recorded.rpcCalls).toEqual([
      {
        name: "update_trip_dates_and_realign_visits",
        args: {
          p_trip_id: 1,
          p_prev_start_date: "2027-07-12",
          p_prev_end_date: "2027-07-18",
          p_next_start_date: "2027-08-01",
          p_next_end_date: "2027-08-07",
          p_visit_changes: [
            { id: 1, visit_date: "2027-08-01" },
            { id: 2, visit_date: "2027-08-07" },
          ],
        },
      },
    ]);
  });

  it("unschedules visits left outside a shortened trip in the same commit", async () => {
    const recorded = { tripUpdates: [], rpcCalls: [] } as Recorded;
    await withDateShiftClient(recorded, async (updateTripForRequest) => {
      await updateTripForRequest(1, "user-1", { end_date: "2027-07-16" });
    });

    // Route reconciliation for the unscheduled visit happens inside the RPC's
    // transaction; the service's contract is that the unschedule rides along.
    expect(recorded.tripUpdates).toEqual([]);
    expect(recorded.rpcCalls).toEqual([
      {
        name: "update_trip_dates_and_realign_visits",
        args: {
          p_trip_id: 1,
          p_prev_start_date: "2027-07-12",
          p_prev_end_date: "2027-07-18",
          p_next_start_date: "2027-07-12",
          p_next_end_date: "2027-07-16",
          p_visit_changes: [{ id: 2, visit_date: null }],
        },
      },
    ]);
  });

  it("still persists the dates when a trip only gains days at the end", async () => {
    const recorded = { tripUpdates: [], rpcCalls: [] } as Recorded;
    await withDateShiftClient(recorded, async (updateTripForRequest) => {
      await updateTripForRequest(1, "user-1", { end_date: "2027-07-25" });
    });

    expect(recorded.tripUpdates).toEqual([]);
    expect(recorded.rpcCalls).toEqual([
      {
        name: "update_trip_dates_and_realign_visits",
        args: {
          p_trip_id: 1,
          p_prev_start_date: "2027-07-12",
          p_prev_end_date: "2027-07-18",
          p_next_start_date: "2027-07-12",
          p_next_end_date: "2027-07-25",
          p_visit_changes: [],
        },
      },
    ]);
  });

  it("routes non-date fields through the plain update, dates through the RPC", async () => {
    const recorded = { tripUpdates: [], rpcCalls: [] } as Recorded;
    await withDateShiftClient(recorded, async (updateTripForRequest) => {
      await updateTripForRequest(1, "user-1", {
        name: "Iceland encore",
        end_date: "2027-07-25",
      });
    });

    expect(recorded.tripUpdates).toHaveLength(1);
    expect(recorded.tripUpdates[0]).toMatchObject({ name: "Iceland encore" });
    expect(recorded.tripUpdates[0]).not.toHaveProperty("start_date");
    expect(recorded.tripUpdates[0]).not.toHaveProperty("end_date");
    expect(recorded.rpcCalls).toHaveLength(1);
    expect(recorded.rpcCalls[0].args).toMatchObject({
      p_next_end_date: "2027-07-25",
    });
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

type Recorded = {
  tripUpdates: Record<string, unknown>[];
  rpcCalls: Array<{ name: string; args: Record<string, unknown> }>;
};

/**
 * Drives updateTripForRequest against a fake Supabase so the real store and
 * shift logic run, and records only what reaches the database.
 */
async function withDateShiftClient(
  recorded: Recorded,
  run: (
    updateTripForRequest: typeof import("@/server/trip-service").updateTripForRequest,
  ) => Promise<void>,
) {
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
    getSupabaseClient: () => dateShiftClient(recorded),
  }));
  vi.doMock("@/server/trip-members", () => ({
    listTripMembers: vi.fn().mockResolvedValue(new Map()),
  }));

  try {
    const { updateTripForRequest } = await import("@/server/trip-service");
    await run(updateTripForRequest);
  } finally {
    vi.doUnmock("@/server/trip-access");
    vi.doUnmock("@/server/supabase");
    vi.doUnmock("@/server/trip-members");
    vi.restoreAllMocks();
    vi.resetModules();
  }
}

function dateShiftClient(recorded: Recorded) {
  const storedTrip = {
    id: 1,
    created_by: "user-1",
    name: "Iceland round tour",
    destination: "Iceland",
    destination_slug: "iceland",
    start_date: "2027-07-12",
    end_date: "2027-07-18",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const visits = [
    { id: 1, visit_date: "2027-07-12" },
    { id: 2, visit_date: "2027-07-18" },
  ];

  return {
    from(table: string) {
      if (table === "trips") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                async single() {
                  return { data: storedTrip, error: null };
                },
              }),
            }),
          }),
          update: (input: Record<string, unknown>) => ({
            async eq() {
              recorded.tripUpdates.push(input);
              return { error: null };
            },
          }),
        };
      }

      // Visit dates are only ever written through the realign RPC; a direct
      // itinerary_items update here would be the non-atomic path regressing.
      if (table === "itinerary_items") {
        return {
          select: () => ({
            eq: () => ({
              async not() {
                return { data: visits, error: null };
              },
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
    async rpc(name: string, args: Record<string, unknown>) {
      recorded.rpcCalls.push({ name, args });
      return { error: null };
    },
  };
}

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
