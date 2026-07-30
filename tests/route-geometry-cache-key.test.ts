import { describe, expect, it } from "vitest";

import { TRANSIT_BUCKET_NOW } from "@/lib/transit-departure";
import { routeGeometryCacheKey } from "@/server/supabase-route-geometry-service";

const NEW_YORK_HOP = {
  from_latitude: 40.7536,
  from_longitude: -73.9832,
  to_latitude: 40.758,
  to_longitude: -73.9855,
};
const NO_DEPARTURE = { bucket: TRANSIT_BUCKET_NOW, departureTime: null };

describe("route geometry cache key", () => {
  // The point of the key: one physical route, one row. Two trips holding their
  // own place rows for the same coordinates must share the cached geometry
  // instead of each paying Google for it.
  it("is identical for the same route regardless of trip", () => {
    expect(
      routeGeometryCacheKey({
        mode: "walking",
        ...NEW_YORK_HOP,
        departure: NO_DEPARTURE,
      }),
    ).toBe(
      routeGeometryCacheKey({
        mode: "walking",
        ...NEW_YORK_HOP,
        departure: NO_DEPARTURE,
      }),
    );
  });

  it("separates modes and directions", () => {
    const walking = routeGeometryCacheKey({
      mode: "walking",
      ...NEW_YORK_HOP,
      departure: NO_DEPARTURE,
    });
    const driving = routeGeometryCacheKey({
      mode: "driving",
      ...NEW_YORK_HOP,
      departure: NO_DEPARTURE,
    });
    const reversed = routeGeometryCacheKey({
      mode: "walking",
      from_latitude: NEW_YORK_HOP.to_latitude,
      from_longitude: NEW_YORK_HOP.to_longitude,
      to_latitude: NEW_YORK_HOP.from_latitude,
      to_longitude: NEW_YORK_HOP.from_longitude,
      departure: NO_DEPARTURE,
    });

    expect(new Set([walking, driving, reversed]).size).toBe(3);
  });

  // Transit duration depends on the schedule, so its rows are per weekday-hour.
  // Clock-independent modes must not carry a bucket, or they would fragment into
  // one row per departure hour for no benefit.
  it("buckets transit by departure and leaves other modes unbucketed", () => {
    const saturdayMorning = routeGeometryCacheKey({
      mode: "transit",
      ...NEW_YORK_HOP,
      departure: { bucket: "sat-10", departureTime: "2026-08-08T14:30:00.000Z" },
    });
    const tuesdayNight = routeGeometryCacheKey({
      mode: "transit",
      ...NEW_YORK_HOP,
      departure: { bucket: "tue-23", departureTime: "2026-08-05T03:30:00.000Z" },
    });

    expect(saturdayMorning).not.toBe(tuesdayNight);
    expect(saturdayMorning.endsWith(":sat-10")).toBe(true);

    const walking = routeGeometryCacheKey({
      mode: "walking",
      ...NEW_YORK_HOP,
      departure: { bucket: "sat-10", departureTime: "2026-08-08T14:30:00.000Z" },
    });
    expect(walking.endsWith(":sat-10")).toBe(false);
  });
});
