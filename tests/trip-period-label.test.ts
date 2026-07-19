import { describe, expect, it } from "vitest";

import { formatTripPeriodLabel } from "@/lib/trip-period-label";
import type { Trip } from "@/lib/types";

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

function buildTrip(startDate: string | null, endDate: string | null): Trip {
  return {
    id: 1,
    created_by: "user-1",
    name: "Tokyo Spring",
    destination: "Toronto",
    destination_slug: "toronto",
    destination_latitude: null,
    destination_longitude: null,
    destination_photo_url: null,
    destination_photo_attribution: null,
    start_date: startDate,
    end_date: endDate,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}
