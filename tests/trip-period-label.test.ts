import { describe, expect, it } from "vitest";

import { formatTripPeriodLabel } from "@/lib/trip-period-label";
import type { Trip } from "@/lib/types";

import { buildTrip as buildTripFixture } from "./helpers/fixtures";

describe("formatTripPeriodLabel", () => {
  it("formats a same-month trip range compactly", () => {
    expect(formatTripPeriodLabel(buildTrip("2026-04-01", "2026-04-07"))).toBe(
      "Apr 1 - 7, 2026",
    );
  });

  it("formats a cross-month trip range with readable spacing", () => {
    expect(formatTripPeriodLabel(buildTrip("2026-08-31", "2026-09-06"))).toBe(
      "Aug 31 - Sep 6, 2026",
    );
  });

  it("formats partial trip dates", () => {
    expect(formatTripPeriodLabel(buildTrip("2026-04-01", null))).toBe(
      "Starts Apr 1, 2026",
    );
    expect(formatTripPeriodLabel(buildTrip(null, "2026-04-07"))).toBe(
      "Ends Apr 7, 2026",
    );
  });

  it("omits the label when no trip dates exist", () => {
    expect(formatTripPeriodLabel(buildTrip(null, null))).toBeNull();
  });
});

// The shared fixture's `??` fallbacks replace null dates with defaults, so
// spread explicit nulls on top instead of passing them as overrides.
function buildTrip(startDate: string | null, endDate: string | null): Trip {
  return { ...buildTripFixture(), start_date: startDate, end_date: endDate };
}
