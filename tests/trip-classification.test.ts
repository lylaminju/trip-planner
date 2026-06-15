import { describe, expect, it, vi } from "vitest";

import type { TripSummary } from "@/lib/types";
import {
  detectBrowserTimeZone,
  groupTripsByTiming,
  isTripOngoing,
} from "@/lib/trip-classification";

const baseTrip: Omit<TripSummary, "id" | "name" | "role"> = {
  created_by: "user-1",
  destination: "Toronto",
  start_date: null,
  end_date: null,
  timezone: "America/Toronto",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("trip dashboard classification", () => {
  it("groups ongoing, missing-date, upcoming, and past trips", () => {
    const groups = groupTripsByTiming(
      [
        trip(1, "Past", "2026-05-01", "2026-05-02"),
        trip(2, "Needs end", "2026-05-10", null),
        trip(3, "Upcoming", "2026-06-01", "2026-06-02"),
        trip(4, "Ongoing", "2026-05-27", "2026-05-29"),
        trip(5, "Needs start", null, "2026-05-30"),
      ],
      new Date("2026-05-28T16:00:00.000Z"),
    );

    expect(groups.ongoing.map((entry) => entry.name)).toEqual(["Ongoing"]);
    expect(groups.needsDates.map((entry) => entry.name)).toEqual([
      "Needs end",
      "Needs start",
    ]);
    expect(groups.upcoming.map((entry) => entry.name)).toEqual(["Upcoming"]);
    expect(groups.past.map((entry) => entry.name)).toEqual(["Past"]);
  });

  it("uses each trip timezone when deciding the local current date", () => {
    const groups = groupTripsByTiming(
      [
        trip(1, "Toronto today", "2026-05-28", "2026-05-28", {
          timezone: "America/Toronto",
        }),
        trip(2, "Tokyo tomorrow", "2026-05-28", "2026-05-28", {
          timezone: "Asia/Tokyo",
        }),
      ],
      new Date("2026-05-28T16:00:00.000Z"),
    );

    expect(groups.ongoing.map((entry) => entry.name)).toEqual([
      "Toronto today",
    ]);
    expect(groups.past.map((entry) => entry.name)).toEqual(["Tokyo tomorrow"]);
  });

  it("detects the browser timezone and falls back when unavailable", () => {
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({
        locale: "en-US",
        calendar: "gregory",
        numberingSystem: "latn",
        timeZone: "America/Vancouver",
      });

    expect(detectBrowserTimeZone()).toBe("America/Vancouver");

    resolvedOptions.mockReturnValue({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "",
    });

    expect(detectBrowserTimeZone()).toBe("America/Toronto");
  });
});

describe("isTripOngoing", () => {
  it("returns true when the trip-local current date is inside the trip range", () => {
    expect(
      isTripOngoing(
        trip(1, "Ongoing", "2026-05-27", "2026-05-29"),
        new Date("2026-05-28T16:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("returns false for missing-date, future, and past trips", () => {
    const now = new Date("2026-05-28T16:00:00.000Z");

    expect(isTripOngoing(trip(1, "Needs start", null, "2026-05-29"), now)).toBe(
      false,
    );
    expect(isTripOngoing(trip(2, "Needs end", "2026-05-27", null), now)).toBe(
      false,
    );
    expect(
      isTripOngoing(trip(3, "Future", "2026-06-01", "2026-06-02"), now),
    ).toBe(false);
    expect(
      isTripOngoing(trip(4, "Past", "2026-05-01", "2026-05-02"), now),
    ).toBe(false);
  });

  it("uses the trip timezone when detecting ongoing trips", () => {
    const now = new Date("2026-05-28T16:00:00.000Z");

    expect(
      isTripOngoing(
        trip(1, "Toronto today", "2026-05-28", "2026-05-28", {
          timezone: "America/Toronto",
        }),
        now,
      ),
    ).toBe(true);
    expect(
      isTripOngoing(
        trip(2, "Tokyo tomorrow", "2026-05-28", "2026-05-28", {
          timezone: "Asia/Tokyo",
        }),
        now,
      ),
    ).toBe(false);
  });

  it("returns false when there is no trip", () => {
    expect(isTripOngoing(null, new Date("2026-05-28T16:00:00.000Z"))).toBe(
      false,
    );
  });
});

function trip(
  id: number,
  name: string,
  startDate: string | null,
  endDate: string | null,
  overrides: Partial<TripSummary> = {},
): TripSummary {
  return {
    ...baseTrip,
    id,
    name,
    role: "owner",
    start_date: startDate,
    end_date: endDate,
    ...overrides,
  };
}
