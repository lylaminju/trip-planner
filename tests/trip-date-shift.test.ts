import { describe, expect, it } from "vitest";

import {
  applyTripDateShift,
  planTripDateShift,
  type ScheduledVisit,
  type TripDateRange,
  type VisitDateChange,
} from "@/lib/trip-date-shift";

const TRIP: TripDateRange = { start_date: "2027-07-12", end_date: "2027-07-18" };

/** One visit per day of the seven-day trip, in trip order. */
const VISITS: ScheduledVisit[] = [
  { id: 1, visit_date: "2027-07-12" },
  { id: 2, visit_date: "2027-07-13" },
  { id: 3, visit_date: "2027-07-14" },
  { id: 4, visit_date: "2027-07-15" },
  { id: 5, visit_date: "2027-07-16" },
  { id: 6, visit_date: "2027-07-17" },
  { id: 7, visit_date: "2027-07-18" },
];

function shift(next: TripDateRange): VisitDateChange[] {
  const plan = planTripDateShift(TRIP, next);
  if (plan === null) throw new Error("expected a shift plan");
  return applyTripDateShift(VISITS, plan);
}

describe("trip-date-shift", () => {
  const cases: Array<{
    name: string;
    next: TripDateRange;
    deltaDays: number;
    changes: VisitDateChange[];
  }> = [
    {
      name: "both edges move by the same amount: every visit slides with the trip",
      next: { start_date: "2027-08-01", end_date: "2027-08-07" },
      deltaDays: 20,
      changes: [
        { id: 1, visit_date: "2027-08-01" },
        { id: 2, visit_date: "2027-08-02" },
        { id: 3, visit_date: "2027-08-03" },
        { id: 4, visit_date: "2027-08-04" },
        { id: 5, visit_date: "2027-08-05" },
        { id: 6, visit_date: "2027-08-06" },
        { id: 7, visit_date: "2027-08-07" },
      ],
    },
    {
      name: "end extends while start holds: nothing moves, the new days are blank",
      next: { start_date: "2027-07-12", end_date: "2027-07-20" },
      deltaDays: 0,
      changes: [],
    },
    {
      name: "end pulls in while start holds: the tail unschedules",
      next: { start_date: "2027-07-12", end_date: "2027-07-16" },
      deltaDays: 0,
      changes: [
        { id: 6, visit_date: null },
        { id: 7, visit_date: null },
      ],
    },
    {
      name: "start moves later while end holds: the front unschedules",
      next: { start_date: "2027-07-14", end_date: "2027-07-18" },
      deltaDays: 0,
      changes: [
        { id: 1, visit_date: null },
        { id: 2, visit_date: null },
      ],
    },
    {
      name: "start moves earlier while end holds: nothing moves, the new days are blank",
      next: { start_date: "2027-07-10", end_date: "2027-07-18" },
      deltaDays: 0,
      changes: [],
    },
    {
      name: "both edges grow: nothing moves, the new days are blank at each end",
      next: { start_date: "2027-07-10", end_date: "2027-07-25" },
      deltaDays: 0,
      changes: [],
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      const plan = planTripDateShift(TRIP, testCase.next);

      expect(plan).not.toBeNull();
      expect(plan?.deltaDays).toBe(testCase.deltaDays);
      expect(shift(testCase.next)).toEqual(testCase.changes);
    });
  }

  it("anchors to the start when both edges move and the trip also shortens", () => {
    expect(shift({ start_date: "2027-08-01", end_date: "2027-08-03" })).toEqual([
      { id: 1, visit_date: "2027-08-01" },
      { id: 2, visit_date: "2027-08-02" },
      { id: 3, visit_date: "2027-08-03" },
      { id: 4, visit_date: null },
      { id: 5, visit_date: null },
      { id: 6, visit_date: null },
      { id: 7, visit_date: null },
    ]);
  });

  it("reports no changes when the dates are resaved untouched", () => {
    expect(shift(TRIP)).toEqual([]);
  });

  it("leaves already-unscheduled visits alone", () => {
    const plan = planTripDateShift(TRIP, {
      start_date: "2027-08-01",
      end_date: "2027-08-07",
    });

    expect(
      applyTripDateShift([{ id: 9, visit_date: null }], plan!),
    ).toEqual([]);
  });

  it("restores a plan that drifted away from its trip", () => {
    // The Iceland regression: a seven-day plan left stranded a year behind the
    // trip after its dates moved.
    const stranded: ScheduledVisit[] = [
      { id: 1, visit_date: "2026-07-16" },
      { id: 2, visit_date: "2026-07-22" },
    ];
    const plan = planTripDateShift(
      { start_date: "2026-07-16", end_date: "2026-07-22" },
      TRIP,
    );

    expect(plan?.deltaDays).toBe(361);
    expect(applyTripDateShift(stranded, plan!)).toEqual([
      { id: 1, visit_date: "2027-07-12" },
      { id: 2, visit_date: "2027-07-18" },
    ]);
  });

  const incomplete: Array<{ name: string; previous: TripDateRange; next: TripDateRange }> =
    [
      {
        name: "the trip had no dates to offset from",
        previous: { start_date: null, end_date: null },
        next: TRIP,
      },
      {
        name: "the dates are being cleared",
        previous: TRIP,
        next: { start_date: null, end_date: null },
      },
      {
        name: "only one edge is set",
        previous: TRIP,
        next: { start_date: "2027-07-12", end_date: null },
      },
      {
        name: "a date is malformed",
        previous: TRIP,
        next: { start_date: "2027-13-45", end_date: "2027-07-18" },
      },
    ];

  for (const testCase of incomplete) {
    it(`plans no shift when ${testCase.name}`, () => {
      expect(planTripDateShift(testCase.previous, testCase.next)).toBeNull();
    });
  }
});
