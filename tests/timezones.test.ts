import { describe, expect, it } from "vitest";

import {
  formatTimeZoneOption,
  getStableTimeZoneOptions,
  getTimeZoneOptions,
  timeZoneDateFromIsoDate,
} from "@/lib/timezones";

describe("timezone options", () => {
  const summerDate = new Date("2026-05-28T12:00:00.000Z");

  it("puts the UTC offset and abbreviation before the raw IANA name", () => {
    expect(formatTimeZoneOption("America/Toronto", summerDate)).toEqual({
      value: "America/Toronto",
      label: "UTC-04:00 EDT - America/Toronto",
    });
  });

  it("falls back to an offset-only prefix when Intl returns an offset name", () => {
    expect(formatTimeZoneOption("Asia/Tokyo", summerDate)).toEqual({
      value: "Asia/Tokyo",
      label: "UTC+09:00 - Asia/Tokyo",
    });
  });

  it("keeps an explicitly included stored timezone selectable", () => {
    const options = getTimeZoneOptions({
      include: ["Custom/Stored"],
      now: summerDate,
    });

    expect(options).toContainEqual({
      value: "Custom/Stored",
      label: "Custom/Stored",
    });
  });

  it("uses the middle of an ISO date as a stable timezone reference date", () => {
    expect(timeZoneDateFromIsoDate("2026-12-15").toISOString()).toBe(
      "2026-12-15T12:00:00.000Z",
    );

    expect(timeZoneDateFromIsoDate(undefined, summerDate)).toBe(summerDate);
  });

  it("provides deterministic initial options for server and hydration renders", () => {
    expect(
      getStableTimeZoneOptions({
        include: ["America/Coyhaique"],
        now: summerDate,
      }).map((option) => option.value),
    ).toEqual([
      "America/Los_Angeles",
      "America/Vancouver",
      "America/Denver",
      "America/Chicago",
      "America/New_York",
      "America/Toronto",
      "UTC",
      "Europe/London",
      "Europe/Paris",
      "Asia/Tokyo",
      "Australia/Sydney",
      "America/Coyhaique",
    ]);
  });
});
