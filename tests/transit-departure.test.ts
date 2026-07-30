import { describe, expect, it } from "vitest";

import { DESTINATIONS } from "@/data/destinations";
import {
  resolveTransitDeparture,
  TRANSIT_BUCKET_NOW,
} from "@/lib/transit-departure";

const NOW = new Date("2026-07-30T12:00:00.000Z");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("transit departure resolution", () => {
  it("buckets by local weekday and hour", () => {
    // 2026-08-08 is a Saturday.
    expect(
      resolveTransitDeparture({
        visitDate: "2026-08-08",
        visitTime: "10:30",
        timeZone: "America/New_York",
        now: NOW,
      }).bucket,
    ).toBe("sat-10");
  });

  it("converts the local wall clock to the matching instant", () => {
    // 10:30 in New York on that date is EDT (UTC-4), so 14:30Z.
    expect(
      resolveTransitDeparture({
        visitDate: "2026-08-08",
        visitTime: "10:30",
        timeZone: "America/New_York",
        now: NOW,
      }).departureTime,
    ).toBe("2026-08-08T14:30:00.000Z");
  });

  it("resolves the same wall clock differently across zones", () => {
    const seoul = resolveTransitDeparture({
      visitDate: "2026-08-08",
      visitTime: "10:30",
      timeZone: "Asia/Seoul",
      now: NOW,
    });
    // Seoul is UTC+9 year round, so 10:30 local is 01:30Z the same day, and the
    // bucket still describes the local hour rather than the UTC one.
    expect(seoul.departureTime).toBe("2026-08-08T01:30:00.000Z");
    expect(seoul.bucket).toBe("sat-10");
  });

  it("falls back to a now-departure when the zone is unknown", () => {
    expect(
      resolveTransitDeparture({
        visitDate: "2026-08-08",
        visitTime: "10:30",
        timeZone: null,
        now: NOW,
      }),
    ).toEqual({ bucket: TRANSIT_BUCKET_NOW, departureTime: null });
  });

  it("falls back to a now-departure when the item is unscheduled", () => {
    expect(
      resolveTransitDeparture({
        visitDate: "2026-08-08",
        visitTime: null,
        timeZone: "America/New_York",
        now: NOW,
      }),
    ).toEqual({ bucket: TRANSIT_BUCKET_NOW, departureTime: null });
  });

  // Routes API rejects transit departures beyond 7 days past / 100 days future,
  // so trips outside that window are shifted by whole weeks. The bucket must not
  // move with them, or a shifted request would poison another bucket's row.
  it.each([
    ["far future", "2028-07-08", "sat-09"],
    ["far past", "2024-03-09", "sat-09"],
    ["far past midweek", "2024-03-07", "thu-09"],
  ])(
    "places a %s trip inside the API window keeping its weekday",
    (_label, visitDate, expectedBucket) => {
      const resolved = resolveTransitDeparture({
        visitDate,
        visitTime: "09:20",
        timeZone: "America/New_York",
        now: NOW,
      });

      expect(resolved.departureTime).not.toBeNull();
      const departure = new Date(resolved.departureTime as string);
      expect(departure.getTime()).toBeGreaterThan(
        NOW.getTime() - 7 * MS_PER_DAY,
      );
      expect(departure.getTime()).toBeLessThan(
        NOW.getTime() + 100 * MS_PER_DAY,
      );
      expect(resolved.bucket).toBe(expectedBucket);
    },
  );

  it("keeps a trip already inside the window untouched", () => {
    expect(
      resolveTransitDeparture({
        visitDate: "2026-09-05",
        visitTime: "18:00",
        timeZone: "America/New_York",
        now: NOW,
      }).departureTime,
    ).toBe("2026-09-05T22:00:00.000Z");
  });
});

describe("curated destination timezones", () => {
  // Asserts what the departure math needs — that Intl can resolve the zone and
  // offset it — rather than membership in Intl.supportedValuesOf. That list holds
  // only ICU's own canonical ids, so it rejects current IANA names such as
  // Asia/Ho_Chi_Minh whose legacy alias (Asia/Saigon) ICU prefers.
  it("gives every destination a zone Intl can offset", () => {
    const broken = DESTINATIONS.filter((destination) => {
      try {
        const resolved = resolveTransitDeparture({
          visitDate: "2026-08-08",
          visitTime: "10:30",
          timeZone: destination.timezone,
          now: NOW,
        });
        return resolved.departureTime === null;
      } catch {
        return true;
      }
    }).map((destination) => `${destination.slug}: ${destination.timezone}`);

    expect(broken).toEqual([]);
  });
});
