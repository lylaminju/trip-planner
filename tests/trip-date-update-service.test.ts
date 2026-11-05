import { describe, expect, it } from "vitest";

import {
  withDateShiftClient,
  type Recorded,
} from "./helpers/trip-date-service-client";

describe("trip date updates", () => {
  it.each([
    { end_date: "2027-07-16" },
    { start_date: "2027-07-14" },
    { start_date: null, end_date: null },
    { start_date: "2027-08-01", end_date: null },
    { start_date: "2027-02-30", end_date: "2027-03-08" },
  ])(
    "rejects an unsafe period before any metadata or date write: %j",
    async (dates) => {
      const recorded: Recorded = { tripUpdates: [], rpcCalls: [] };
      await withDateShiftClient(recorded, async (update) => {
        await expect(
          update(1, "user-1", { name: "Changed name", ...dates }),
        ).rejects.toMatchObject({ name: "TripValidationError" });
      });
      expect(recorded).toEqual({ tripUpdates: [], rpcCalls: [] });
    },
  );

  it("allows shortening and shifting when all scheduled days fit", async () => {
    const recorded: Recorded = { tripUpdates: [], rpcCalls: [] };
    await withDateShiftClient(
      recorded,
      async (update) => {
        await update(1, "user-1", {
          start_date: "2027-08-01",
          end_date: "2027-08-03",
        });
      },
      { visits: [{ id: 1, visit_date: "2027-07-14" }] },
    );
    expect(recorded.rpcCalls[0].args.p_visit_changes).toEqual([
      { id: 1, visit_date: "2027-08-03" },
    ]);
  });

  it("allows clearing dates when there are no scheduled visits", async () => {
    const recorded: Recorded = { tripUpdates: [], rpcCalls: [] };
    await withDateShiftClient(
      recorded,
      async (update) => {
        await update(1, "user-1", { start_date: null, end_date: null });
      },
      { visits: [] },
    );
    expect(recorded.rpcCalls[0].args).toMatchObject({
      p_next_start_date: null,
      p_next_end_date: null,
      p_visit_changes: [],
    });
  });

  it("keeps legacy visit dates untouched on a metadata-only save", async () => {
    const recorded: Recorded = { tripUpdates: [], rpcCalls: [] };
    await withDateShiftClient(
      recorded,
      async (update) => {
        await update(1, "user-1", {
          name: "New name",
          start_date: "2027-07-12",
          end_date: "2027-07-18",
        });
      },
      { visits: [{ id: 1, visit_date: "2026-01-01" }] },
    );
    expect(recorded.tripUpdates[0]).toMatchObject({ name: "New name" });
    expect(recorded.rpcCalls).toEqual([]);
  });

  it("checks existing calendar dates when a trip gains its first complete range", async () => {
    const recorded: Recorded = { tripUpdates: [], rpcCalls: [] };
    await withDateShiftClient(
      recorded,
      async (update) => {
        await expect(
          update(1, "user-1", {
            start_date: "2027-08-01",
            end_date: "2027-08-07",
          }),
        ).rejects.toMatchObject({ name: "TripValidationError" });
      },
      { dates: { start_date: null, end_date: null } },
    );
    expect(recorded.rpcCalls).toEqual([]);
  });

  it("propagates atomic RPC failures without a plain date update fallback", async () => {
    const recorded: Recorded = { tripUpdates: [], rpcCalls: [] };
    await withDateShiftClient(
      recorded,
      async (update) => {
        await expect(
          update(1, "user-1", {
            start_date: "2027-08-01",
            end_date: "2027-08-07",
          }),
        ).rejects.toThrow("dates changed concurrently");
      },
      { rpcError: "dates changed concurrently" },
    );
    expect(recorded.tripUpdates).toEqual([]);
    expect(recorded.rpcCalls).toHaveLength(1);
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
});
