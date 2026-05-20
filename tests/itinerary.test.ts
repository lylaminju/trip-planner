import { describe, expect, it } from "vitest";
import { buildItinerary, compareScheduledPlaces } from "@/lib/itinerary";
import type { Place, RouteSegment } from "@/lib/types";

const basePlace = {
  address: null,
  google_maps_url: "https://www.google.com/maps",
  place_id: null,
  google_place_token: null,
  google_internal_ids: null,
  source_list_url: null,
  latitude: 40,
  longitude: -73,
  notes: null,
  created_at: "2026-05-19 00:00:00",
  updated_at: "2026-05-19 00:00:00",
};

function place(overrides: Partial<Place> & Pick<Place, "id" | "name">): Place {
  return {
    ...basePlace,
    visit_date: null,
    visit_time: null,
    ...overrides,
  };
}

describe("compareScheduledPlaces", () => {
  it("sorts timed places before untimed places", () => {
    const timed = place({ id: 1, name: "Timed", visit_date: "2026-06-01", visit_time: "09:00" });
    const untimed = place({ id: 2, name: "Untimed", visit_date: "2026-06-01" });

    expect(compareScheduledPlaces(timed, untimed)).toBeLessThan(0);
    expect(compareScheduledPlaces(untimed, timed)).toBeGreaterThan(0);
  });

  it("falls back to name ordering for equal times", () => {
    const zoo = place({ id: 1, name: "Zoo", visit_date: "2026-06-01", visit_time: "09:00" });
    const aquarium = place({
      id: 2,
      name: "Aquarium",
      visit_date: "2026-06-01",
      visit_time: "09:00",
    });

    expect(compareScheduledPlaces(zoo, aquarium)).toBeGreaterThan(0);
    expect(compareScheduledPlaces(aquarium, zoo)).toBeLessThan(0);
  });

  it("treats non-padded times as their parsed local time values", () => {
    const nine = place({ id: 1, name: "Nine", visit_date: "2026-06-01", visit_time: "9:00" });
    const ten = place({ id: 2, name: "Ten", visit_date: "2026-06-01", visit_time: "10:00" });

    expect(compareScheduledPlaces(nine, ten)).toBeLessThan(0);
    expect(compareScheduledPlaces(ten, nine)).toBeGreaterThan(0);
  });

  it("sorts valid times before malformed times", () => {
    const valid = place({ id: 1, name: "Valid", visit_date: "2026-06-01", visit_time: "09:00" });
    const invalid = place({
      id: 2,
      name: "Invalid",
      visit_date: "2026-06-01",
      visit_time: "foo",
    });

    expect(compareScheduledPlaces(valid, invalid)).toBeLessThan(0);
    expect(compareScheduledPlaces(invalid, valid)).toBeGreaterThan(0);
  });

  it("treats malformed times like untimed places for ordering", () => {
    const invalid = place({
      id: 1,
      name: "Zoo",
      visit_date: "2026-06-01",
      visit_time: "foo",
    });
    const untimed = place({ id: 2, name: "Aquarium", visit_date: "2026-06-01" });

    expect(compareScheduledPlaces(invalid, untimed)).toBeGreaterThan(0);
    expect(compareScheduledPlaces(untimed, invalid)).toBeLessThan(0);
  });

  it("falls back deterministically when both times are malformed", () => {
    const zebra = place({ id: 1, name: "Zebra", visit_date: "2026-06-01", visit_time: "bar" });
    const alpha = place({ id: 2, name: "Alpha", visit_date: "2026-06-01", visit_time: "foo" });

    expect(compareScheduledPlaces(zebra, alpha)).toBeGreaterThan(0);
    expect(compareScheduledPlaces(alpha, zebra)).toBeLessThan(0);
  });
});

describe("buildItinerary", () => {
  it("groups scheduled places by date with timed places before untimed places", () => {
    const result = buildItinerary(
      [
        place({ id: 1, name: "Guggenheim", visit_date: "2026-06-01" }),
        place({ id: 2, name: "A Stop", visit_date: "2026-06-01", visit_time: "11:00" }),
        place({ id: 3, name: "B Stop", visit_date: "2026-06-01", visit_time: "09:00" }),
        place({ id: 4, name: "Central Park", visit_date: "2026-06-01" }),
      ],
      [],
    );

    expect(result.days).toHaveLength(1);
    expect(result.days[0].places.map((item) => item.name)).toEqual([
      "B Stop",
      "A Stop",
      "Central Park",
      "Guggenheim",
    ]);
  });

  it("sorts timed places with the same time by name", () => {
    const result = buildItinerary(
      [
        place({ id: 1, name: "Zoo", visit_date: "2026-06-01", visit_time: "09:00" }),
        place({ id: 2, name: "Aquarium", visit_date: "2026-06-01", visit_time: "09:00" }),
        place({ id: 3, name: "Museum", visit_date: "2026-06-01", visit_time: "10:00" }),
      ],
      [],
    );

    expect(result.days[0].places.map((item) => item.name)).toEqual([
      "Aquarium",
      "Zoo",
      "Museum",
    ]);
  });

  it("keeps unscheduled places separate and alphabetized", () => {
    const result = buildItinerary(
      [
        place({ id: 1, name: "Zoo" }),
        place({ id: 2, name: "Aquarium" }),
        place({ id: 3, name: "Museum", visit_date: "2026-06-02", visit_time: "10:00" }),
      ],
      [],
    );

    expect(result.unscheduled.map((item) => item.name)).toEqual(["Aquarium", "Zoo"]);
    expect(result.days[0].date).toBe("2026-06-02");
  });

  it("keeps existing day colors stable when a date is inserted between them", () => {
    const initial = buildItinerary(
      [
        place({ id: 1, name: "A", visit_date: "2026-06-01", visit_time: "09:00" }),
        place({ id: 2, name: "B", visit_date: "2026-06-03", visit_time: "10:00" }),
      ],
      [],
    );

    const updated = buildItinerary(
      [
        place({ id: 1, name: "A", visit_date: "2026-06-01", visit_time: "09:00" }),
        place({ id: 2, name: "B", visit_date: "2026-06-03", visit_time: "10:00" }),
        place({ id: 3, name: "C", visit_date: "2026-06-02", visit_time: "11:00" }),
      ],
      [],
    );

    const initialColors = new Map(initial.days.map((day) => [day.date, day.color]));
    const updatedColors = new Map(updated.days.map((day) => [day.date, day.color]));

    expect(updated.days.map((day) => day.date)).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);
    expect(updatedColors.get("2026-06-01")).toBe(initialColors.get("2026-06-01"));
    expect(updatedColors.get("2026-06-03")).toBe(initialColors.get("2026-06-03"));
  });

  it("attaches route segments for matching consecutive timed place pairs", () => {
    const segments: RouteSegment[] = [
      {
        id: 20,
        from_place_id: 1,
        to_place_id: 2,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
      {
        id: 21,
        from_place_id: 2,
        to_place_id: 3,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
    ];

    const result = buildItinerary(
      [
        place({ id: 1, name: "A", visit_date: "2026-06-01", visit_time: "09:00" }),
        place({ id: 2, name: "B", visit_date: "2026-06-01", visit_time: "10:00" }),
        place({ id: 3, name: "C", visit_date: "2026-06-01", visit_time: "11:00" }),
      ],
      segments,
    );

    expect(result.days[0].segments).toEqual([
      {
        fromPlaceId: 1,
        toPlaceId: 2,
        segment: segments[0],
      },
      {
        fromPlaceId: 2,
        toPlaceId: 3,
        segment: segments[1],
      },
    ]);
  });

  it("excludes non-consecutive timed route segments even when they exist", () => {
    const segments: RouteSegment[] = [
      {
        id: 20,
        from_place_id: 1,
        to_place_id: 2,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
      {
        id: 21,
        from_place_id: 1,
        to_place_id: 3,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
    ];

    const result = buildItinerary(
      [
        place({ id: 1, name: "A", visit_date: "2026-06-01", visit_time: "09:00" }),
        place({ id: 2, name: "B", visit_date: "2026-06-01", visit_time: "10:00" }),
        place({ id: 3, name: "C", visit_date: "2026-06-01", visit_time: "11:00" }),
      ],
      segments,
    );

    expect(result.days[0].segments).toEqual([
      {
        fromPlaceId: 1,
        toPlaceId: 2,
        segment: segments[0],
      },
    ]);
    expect(result.days[0].segments).not.toContainEqual({
      fromPlaceId: 1,
      toPlaceId: 3,
      segment: segments[1],
    });
  });

  it("ignores malformed visit times when constructing route segments", () => {
    const segments: RouteSegment[] = [
      {
        id: 20,
        from_place_id: 1,
        to_place_id: 2,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
      {
        id: 21,
        from_place_id: 2,
        to_place_id: 3,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
      {
        id: 22,
        from_place_id: 1,
        to_place_id: 3,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
      {
        id: 23,
        from_place_id: 3,
        to_place_id: 2,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
    ];

    const result = buildItinerary(
      [
        place({ id: 1, name: "A", visit_date: "2026-06-01", visit_time: "09:00" }),
        place({ id: 2, name: "B", visit_date: "2026-06-01", visit_time: "foo" }),
        place({ id: 3, name: "C", visit_date: "2026-06-01", visit_time: "10:00" }),
      ],
      segments,
    );

    expect(result.days[0].segments).toEqual([
      {
        fromPlaceId: 1,
        toPlaceId: 3,
        segment: segments[2],
      },
    ]);
    expect(result.days[0].segments).not.toContainEqual({
      fromPlaceId: 3,
      toPlaceId: 2,
      segment: segments[3],
    });
  });
});
