import { describe, expect, it } from "vitest";

import { resolveTimeZone } from "@/lib/daily-counts";
import { GUEST_EVENT_NAMES } from "@/server/guest-events";
import {
  aggregateGuestActivity,
  type GuestEventRow,
} from "@/server/supabase-admin-guest-activity-store";

const DATES = ["2026-07-24", "2026-07-25", "2026-07-26"];
const UTC = "UTC";
const TORONTO = "America/Toronto";

const GUEST_A = "11111111-1111-4111-8111-111111111111";
const GUEST_B = "22222222-2222-4222-8222-222222222222";

function row(guestId: string, eventName: string, createdAt: string): GuestEventRow {
  return { guest_id: guestId, event_name: eventName, created_at: createdAt };
}

describe("aggregateGuestActivity", () => {
  it("returns zero-filled series for every date and every event name when there are no rows", () => {
    const stats = aggregateGuestActivity([], DATES, UTC);

    expect(stats.activeGuestsByDay).toEqual(DATES.map((date) => ({ date, count: 0 })));
    expect(stats.eventCharts.map((c) => c.eventName)).toEqual([...GUEST_EVENT_NAMES]);
    for (const chart of stats.eventCharts) {
      expect(chart.byDay).toEqual(DATES.map((date) => ({ date, count: 0 })));
    }
  });

  it("counts each guest once per day regardless of how many events they fire", () => {
    const stats = aggregateGuestActivity(
      [
        row(GUEST_A, "trip_created", "2026-07-24T09:00:00.000Z"),
        row(GUEST_A, "place_added", "2026-07-24T09:05:00.000Z"),
        row(GUEST_B, "sample_cloned", "2026-07-24T10:00:00.000Z"),
        row(GUEST_A, "place_added", "2026-07-26T08:00:00.000Z"),
      ],
      DATES,
      UTC,
    );

    expect(stats.activeGuestsByDay).toEqual([
      { date: "2026-07-24", count: 2 },
      { date: "2026-07-25", count: 0 },
      { date: "2026-07-26", count: 1 },
    ]);
  });

  it("buckets event counts by name and day", () => {
    const stats = aggregateGuestActivity(
      [
        row(GUEST_A, "place_added", "2026-07-24T09:00:00.000Z"),
        row(GUEST_A, "place_added", "2026-07-24T09:05:00.000Z"),
        row(GUEST_B, "place_added", "2026-07-25T10:00:00.000Z"),
        row(GUEST_B, "generation_run", "2026-07-25T10:30:00.000Z"),
      ],
      DATES,
      UTC,
    );

    const byName = new Map(stats.eventCharts.map((c) => [c.eventName, c.byDay]));
    expect(byName.get("place_added")).toEqual([
      { date: "2026-07-24", count: 2 },
      { date: "2026-07-25", count: 1 },
      { date: "2026-07-26", count: 0 },
    ]);
    expect(byName.get("generation_run")).toEqual([
      { date: "2026-07-24", count: 0 },
      { date: "2026-07-25", count: 1 },
      { date: "2026-07-26", count: 0 },
    ]);
  });

  it("counts unknown event names toward active guests but gives them no chart", () => {
    const stats = aggregateGuestActivity(
      [row(GUEST_A, "not_a_real_event", "2026-07-25T12:00:00.000Z")],
      DATES,
      UTC,
    );

    expect(stats.activeGuestsByDay).toEqual([
      { date: "2026-07-24", count: 0 },
      { date: "2026-07-25", count: 1 },
      { date: "2026-07-26", count: 0 },
    ]);
    expect(stats.eventCharts.map((c) => c.eventName)).toEqual([...GUEST_EVENT_NAMES]);
    for (const chart of stats.eventCharts) {
      expect(chart.byDay.every((d) => d.count === 0)).toBe(true);
    }
  });

  it("excludes internal guests from active counts and event charts", () => {
    const stats = aggregateGuestActivity(
      [
        row(GUEST_A, "trip_created", "2026-07-24T09:00:00.000Z"),
        row(GUEST_A, "place_added", "2026-07-25T09:00:00.000Z"),
        row(GUEST_B, "place_added", "2026-07-25T10:00:00.000Z"),
      ],
      DATES,
      UTC,
      new Set([GUEST_A]),
    );

    expect(stats.activeGuestsByDay).toEqual([
      { date: "2026-07-24", count: 0 },
      { date: "2026-07-25", count: 1 },
      { date: "2026-07-26", count: 0 },
    ]);
    const byName = new Map(stats.eventCharts.map((c) => [c.eventName, c.byDay]));
    expect(byName.get("trip_created")?.every((d) => d.count === 0)).toBe(true);
    expect(byName.get("place_added")).toEqual([
      { date: "2026-07-24", count: 0 },
      { date: "2026-07-25", count: 1 },
      { date: "2026-07-26", count: 0 },
    ]);
  });

  it("buckets by the viewer's timezone, not UTC", () => {
    // 01:00 UTC on Jul 27 is still 9pm Jul 26 in Toronto (UTC-4 in summer).
    const rows = [row(GUEST_A, "place_added", "2026-07-27T01:00:00.000Z")];

    const toronto = aggregateGuestActivity(rows, DATES, TORONTO);
    expect(toronto.activeGuestsByDay).toEqual([
      { date: "2026-07-24", count: 0 },
      { date: "2026-07-25", count: 0 },
      { date: "2026-07-26", count: 1 },
    ]);

    const utc = aggregateGuestActivity(rows, DATES, UTC);
    expect(utc.activeGuestsByDay.every((d) => d.count === 0)).toBe(true);
  });
});

describe("resolveTimeZone", () => {
  it("accepts a valid IANA timezone", () => {
    expect(resolveTimeZone(TORONTO)).toBe(TORONTO);
  });

  it.each([
    ["unknown zone", "Not/AZone"],
    ["empty string", ""],
    ["non-string", 42],
    ["missing", null],
    ["overlong input", "A".repeat(300)],
  ])("falls back to UTC on %s", (_label, value) => {
    expect(resolveTimeZone(value)).toBe(UTC);
  });
});
