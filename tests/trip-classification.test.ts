import { describe, expect, it, vi } from "vitest";

import type { TripSummary } from "@/lib/types";
import {
  detectBrowserTimeZone,
  groupTripsByTiming,
  isTripOngoing,
} from "@/lib/trip-classification";

const baseTrip: Omit<TripSummary, "id" | "name" | "role"> = {
  created_by: "user-1",
  members: [],
  destination: "Toronto",
  destination_slug: "toronto",
  destination_latitude: null,
  destination_longitude: null,
  destination_country_codes: null,
  destination_photo_url: null,
  destination_photo_attribution: null,
  start_date: null,
  end_date: null,
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

  it("uses the viewer timezone when deciding the local current date", () => {
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
      "Asia/Tokyo",
    );

    expect(groups.ongoing.map((entry) => entry.name)).toEqual([]);
    expect(groups.past.map((entry) => entry.name)).toEqual([
      "Toronto today",
      "Tokyo tomorrow",
    ]);
  });

  it("sorts past trips by most recent end date first", () => {
    const groups = groupTripsByTiming(
      [
        trip(1, "Oldest", "2026-03-01", "2026-03-03"),
        trip(2, "Newest", "2026-05-10", "2026-05-12"),
        trip(3, "Middle", "2026-04-04", "2026-04-08"),
      ],
      new Date("2026-05-28T16:00:00.000Z"),
    );

    expect(groups.past.map((entry) => entry.name)).toEqual([
      "Newest",
      "Middle",
      "Oldest",
    ]);
  });

  it("sorts ongoing and upcoming trips by start date regardless of input order", () => {
    const groups = groupTripsByTiming(
      [
        trip(1, "Later upcoming", "2027-06-01", "2027-06-02"),
        trip(2, "Ongoing early", "2026-05-20", "2026-06-10"),
        trip(3, "Sooner upcoming", "2026-06-01", "2026-06-02"),
        trip(4, "Ongoing late", "2026-05-27", "2026-05-29"),
      ],
      new Date("2026-05-28T16:00:00.000Z"),
    );

    expect(groups.ongoing.map((entry) => entry.name)).toEqual([
      "Ongoing early",
      "Ongoing late",
    ]);
    expect(groups.upcoming.map((entry) => entry.name)).toEqual([
      "Sooner upcoming",
      "Later upcoming",
    ]);
  });

  it("orders trips sharing a start date by creation time", () => {
    const groups = groupTripsByTiming(
      [
        trip(1, "Created second", "2026-06-01", "2026-06-02", {
          created_at: "2026-02-01T00:00:00.000Z",
        }),
        trip(2, "Created first", "2026-06-01", "2026-06-02", {
          created_at: "2026-01-01T00:00:00.000Z",
        }),
      ],
      new Date("2026-05-28T16:00:00.000Z"),
    );

    expect(groups.upcoming.map((entry) => entry.name)).toEqual([
      "Created first",
      "Created second",
    ]);
  });

  it("orders undated trips by creation time", () => {
    const groups = groupTripsByTiming(
      [
        trip(1, "Added later", null, null, {
          created_at: "2026-02-01T00:00:00.000Z",
        }),
        trip(2, "Added earlier", null, null, {
          created_at: "2026-01-01T00:00:00.000Z",
        }),
      ],
      new Date("2026-05-28T16:00:00.000Z"),
    );

    expect(groups.needsDates.map((entry) => entry.name)).toEqual([
      "Added earlier",
      "Added later",
    ]);
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

  it("uses the viewer timezone when detecting ongoing trips", () => {
    const now = new Date("2026-05-28T16:00:00.000Z");

    expect(
      isTripOngoing(
        trip(1, "Toronto today", "2026-05-28", "2026-05-28", {
          timezone: "America/Toronto",
        }),
        now,
        "Asia/Tokyo",
      ),
    ).toBe(false);
    expect(
      isTripOngoing(
        trip(2, "Tokyo tomorrow", "2026-05-28", "2026-05-28", {
          timezone: "Asia/Tokyo",
        }),
        now,
        "America/Toronto",
      ),
    ).toBe(true);
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
  overrides: Partial<TripSummary> & { timezone?: string } = {},
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
