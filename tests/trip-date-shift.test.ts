import { describe, expect, it } from "vitest";

import {
  applyTripDateShift,
  getTripDateChangeError,
  planTripDateShift,
  type ScheduledVisit,
  type TripDateRange,
} from "@/lib/trip-date-shift";

const TRIP: TripDateRange = {
  start_date: "2027-07-12",
  end_date: "2027-07-18",
};
const VISITS: ScheduledVisit[] = [
  { id: 1, visit_date: "2027-07-12" },
  { id: 2, visit_date: "2027-07-14" },
  { id: 3, visit_date: "2027-07-18" },
  { id: 4, visit_date: null },
];

function shift(next: TripDateRange, visits = VISITS, previous = TRIP) {
  const plan = planTripDateShift(previous, next);
  if (plan === null) throw new Error("expected a shift plan");
  return applyTripDateShift(visits, plan);
}

describe("trip-date-shift", () => {
  it.each([
    ["forward", "2027-08-01", "2027-08-07", 20, "2027-08-03"],
    ["backward", "2027-07-05", "2027-07-11", -7, "2027-07-07"],
    ["earlier while end holds", "2027-07-10", "2027-07-18", -2, "2027-07-12"],
    ["expanded on both ends", "2027-07-10", "2027-07-25", -2, "2027-07-12"],
  ])(
    "preserves day numbers when moving %s",
    (_name, start, end, delta, middle) => {
      const next = { start_date: start as string, end_date: end as string };
      expect(planTripDateShift(TRIP, next)?.deltaDays).toBe(delta);
      expect(getTripDateChangeError(TRIP, next, VISITS)).toBeNull();
      const changes = shift(next);
      expect(changes).toHaveLength(3);
      expect(changes[0]).toEqual({ id: 1, visit_date: start });
      expect(changes[1]).toEqual({ id: 2, visit_date: middle });
      // The scheduled last day stays Day 7, even when the new trip is longer.
      expect(changes[2]).toEqual({
        id: 3,
        visit_date: new Date(Date.parse(`${start}T00:00:00Z`) + 6 * 86_400_000)
          .toISOString()
          .slice(0, 10),
      });
    },
  );

  it.each([
    ["unchanged", "2027-07-18"],
    ["extended at the end", "2027-07-25"],
  ])("keeps calendar dates when the start is %s", (_name, end) => {
    const next = { ...TRIP, end_date: end };
    expect(getTripDateChangeError(TRIP, next, VISITS)).toBeNull();
    expect(shift(next)).toEqual([]);
  });

  it.each([
    { start_date: "2027-07-12", end_date: "2027-07-16" },
    { start_date: "2027-07-14", end_date: "2027-07-18" },
    { start_date: "2027-08-01", end_date: "2027-08-03" },
  ])("rejects a shorter trip that cannot hold scheduled days: %j", (next) => {
    expect(getTripDateChangeError(TRIP, next, VISITS)).toContain("Day 7");
    expect(() => shift(next)).toThrow("outside the new trip dates");
    expect(VISITS[2].visit_date).toBe("2027-07-18");
  });

  it("allows shortening when only empty trailing days are removed", () => {
    const visits = VISITS.slice(0, 2);
    const next = { start_date: "2027-08-01", end_date: "2027-08-03" };
    expect(getTripDateChangeError(TRIP, next, visits)).toBeNull();
    expect(shift(next, visits)).toEqual([
      { id: 1, visit_date: "2027-08-01" },
      { id: 2, visit_date: "2027-08-03" },
    ]);
  });

  it.each([
    ["2028-02-28", "2028-03-01", "2028-03-10", "2028-03-12", 11],
    ["2027-03-13", "2027-03-15", "2027-11-06", "2027-11-08", 238],
    ["2027-12-31", "2028-01-02", "2026-12-31", "2027-01-02", -365],
  ])(
    "uses calendar days across leap years, DST and year boundaries",
    (start, end, nextStart, nextEnd, delta) => {
      const previous = { start_date: start as string, end_date: end as string };
      const next = {
        start_date: nextStart as string,
        end_date: nextEnd as string,
      };
      const visits = [
        { id: 1, visit_date: start as string },
        { id: 2, visit_date: end as string },
      ];
      expect(planTripDateShift(previous, next)?.deltaDays).toBe(delta);
      expect(shift(next, visits, previous)).toEqual([
        { id: 1, visit_date: nextStart },
        { id: 2, visit_date: nextEnd },
      ]);
    },
  );

  it.each([
    { start_date: null, end_date: null },
    { start_date: "2027-07-12", end_date: null },
    { start_date: null, end_date: "2027-07-18" },
  ])("requires complete dates only when visits are scheduled: %j", (next) => {
    expect(getTripDateChangeError(TRIP, next, VISITS)).toContain(
      "both trip dates",
    );
    expect(getTripDateChangeError(TRIP, next, [])).toBeNull();
    expect(
      getTripDateChangeError(TRIP, next, [{ id: 1, visit_date: null }]),
    ).toBeNull();
    expect(planTripDateShift(TRIP, next)).toBeNull();
  });

  it.each([
    { start_date: "2027-02-29", end_date: "2027-03-01" },
    { start_date: "2027-13-01", end_date: "2027-13-07" },
    { start_date: "2027-7-12", end_date: "2027-07-18" },
    { start_date: "", end_date: "2027-07-18" },
    { start_date: "2027-07-18", end_date: "2027-07-12" },
  ])("fails closed on malformed or reversed dates: %j", (next) => {
    expect(getTripDateChangeError(TRIP, next, VISITS)).toBeTruthy();
    expect(getTripDateChangeError(TRIP, next, [])).toBeTruthy();
    expect(planTripDateShift(TRIP, next)).toBeNull();
  });

  it("leaves existing calendar dates when a trip previously had no complete range", () => {
    const previous = { start_date: null, end_date: null };
    expect(planTripDateShift(previous, TRIP)).toBeNull();
    expect(getTripDateChangeError(previous, TRIP, VISITS)).toBeNull();
    expect(
      getTripDateChangeError(
        previous,
        {
          start_date: "2027-07-13",
          end_date: "2027-07-19",
        },
        VISITS,
      ),
    ).toContain("before the new trip dates");
    expect(
      getTripDateChangeError(
        previous,
        {
          start_date: "2027-07-11",
          end_date: "2027-07-17",
        },
        VISITS,
      ),
    ).toContain("after the new trip dates");
  });

  it("allows metadata-only saves without rewriting legacy out-of-range visits", () => {
    expect(
      getTripDateChangeError(TRIP, TRIP, [{ id: 1, visit_date: "2026-07-12" }]),
    ).toBeNull();
  });

  it("rejects malformed scheduled dates rather than omitting their changes", () => {
    const visits = [{ id: 1, visit_date: "2027-02-30" }];
    const next = { start_date: "2027-08-01", end_date: "2027-08-07" };
    expect(getTripDateChangeError(TRIP, next, visits)).toContain(
      "invalid date",
    );
    expect(() => shift(next, visits)).toThrow("invalid date");
  });
});
