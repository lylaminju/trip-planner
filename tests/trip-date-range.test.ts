import { describe, expect, it } from "vitest";

import {
  buildTripCalendarMonth,
  formatTripDateRangeSummary,
  monthKeyFromYearMonth,
  selectTripDateRangeDate,
  tripCalendarYearFromMonthKey,
  visibleTripCalendarYears,
  visibleTripCalendarMonths,
} from "@/components/trip-date-range";

describe("trip date range selection", () => {
  it("keeps the end-date selection in the same consecutive calendar context", () => {
    const started = selectTripDateRangeDate(
      { startDate: "", endDate: "" },
      "2019-03-12",
    );

    expect(started).toEqual({
      startDate: "2019-03-12",
      endDate: "",
    });
    expect(visibleTripCalendarMonths(started.startDate)).toEqual([
      "2019-03",
      "2019-04",
    ]);

    expect(selectTripDateRangeDate(started, "2019-03-18")).toEqual({
      startDate: "2019-03-12",
      endDate: "2019-03-18",
    });
  });

  it("normalizes a range when the second selected date is before the start", () => {
    expect(
      selectTripDateRangeDate(
        { startDate: "2019-03-20", endDate: "" },
        "2019-03-12",
      ),
    ).toEqual({
      startDate: "2019-03-12",
      endDate: "2019-03-20",
    });
  });

  it("starts a new range when selecting after a completed range", () => {
    expect(
      selectTripDateRangeDate(
        { startDate: "2019-03-12", endDate: "2019-03-18" },
        "2019-04-02",
      ),
    ).toEqual({
      startDate: "2019-04-02",
      endDate: "",
    });
  });

  it("formats compact date range summaries", () => {
    expect(formatTripDateRangeSummary("", "")).toBe("Add dates");
    expect(formatTripDateRangeSummary("2019-03-12", "")).toBe(
      "Mar 12, 2019 - End date",
    );
    expect(formatTripDateRangeSummary("2019-03-12", "2019-03-18")).toBe(
      "Mar 12 - 18, 2019",
    );
  });

  it("renders every calendar month with the same six week rows", () => {
    expect(buildTripCalendarMonth("2026-02").days).toHaveLength(42);
    expect(buildTripCalendarMonth("2026-03").days).toHaveLength(42);
  });

  it("builds direct month jumps from a selected year and month", () => {
    const jumpedMonth = monthKeyFromYearMonth(2031, 9);

    expect(jumpedMonth).toBe("2031-09");
    expect(visibleTripCalendarMonths(jumpedMonth)).toEqual([
      "2031-09",
      "2031-10",
    ]);
    expect(tripCalendarYearFromMonthKey(jumpedMonth)).toBe(2031);
  });

  it("builds a bounded year list around the visible calendar year", () => {
    expect(visibleTripCalendarYears(2026, 2)).toEqual([
      2024, 2025, 2026, 2027, 2028,
    ]);
  });
});
