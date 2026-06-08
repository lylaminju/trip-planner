import { describe, expect, it } from "vitest";
import { buildItinerary, compareScheduledPlaces } from "@/lib/itinerary";
import type { ItineraryItem, Place, RouteSegment } from "@/lib/types";

const basePlace = {
  trip_id: 1,
  address: null,
  google_maps_url: "https://www.google.com/maps",
  place_id: null,
  google_place_token: null,
  google_internal_ids: null,
  source_list_url: null,
  latitude: 40,
  longitude: -73,
  notes: null,
  links: [],
  created_at: "2026-05-19 00:00:00",
  updated_at: "2026-05-19 00:00:00",
};

function place(
  overrides: Partial<Place> &
    Partial<Pick<ItineraryItem, "visit_date" | "visit_time" | "notes">> &
    Pick<Place, "id" | "name">,
): ItineraryItem {
  const canonicalPlace: Place = {
    ...basePlace,
    ...overrides,
  };

  return {
    id: overrides.id,
    trip_id: canonicalPlace.trip_id,
    place_id: overrides.id,
    visit_date: overrides.visit_date ?? null,
    visit_time: overrides.visit_time ?? null,
    notes: overrides.notes ?? null,
    created_at: canonicalPlace.created_at,
    updated_at: canonicalPlace.updated_at,
    place: canonicalPlace,
  };
}

describe("compareScheduledPlaces", () => {
  it("sorts timed places before untimed places", () => {
    const timed = place({
      id: 1,
      name: "Timed",
      visit_date: "2026-06-01",
      visit_time: "09:00",
    });
    const untimed = place({ id: 2, name: "Untimed", visit_date: "2026-06-01" });

    expect(compareScheduledPlaces(timed, untimed)).toBeLessThan(0);
    expect(compareScheduledPlaces(untimed, timed)).toBeGreaterThan(0);
  });

  it("falls back to name ordering for equal times", () => {
    const zoo = place({
      id: 1,
      name: "Zoo",
      visit_date: "2026-06-01",
      visit_time: "09:00",
    });
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
    const nine = place({
      id: 1,
      name: "Nine",
      visit_date: "2026-06-01",
      visit_time: "9:00",
    });
    const ten = place({
      id: 2,
      name: "Ten",
      visit_date: "2026-06-01",
      visit_time: "10:00",
    });

    expect(compareScheduledPlaces(nine, ten)).toBeLessThan(0);
    expect(compareScheduledPlaces(ten, nine)).toBeGreaterThan(0);
  });

  it("sorts valid times before malformed times", () => {
    const valid = place({
      id: 1,
      name: "Valid",
      visit_date: "2026-06-01",
      visit_time: "09:00",
    });
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
    const untimed = place({
      id: 2,
      name: "Aquarium",
      visit_date: "2026-06-01",
    });

    expect(compareScheduledPlaces(invalid, untimed)).toBeGreaterThan(0);
    expect(compareScheduledPlaces(untimed, invalid)).toBeLessThan(0);
  });

  it("falls back deterministically when both times are malformed", () => {
    const zebra = place({
      id: 1,
      name: "Zebra",
      visit_date: "2026-06-01",
      visit_time: "bar",
    });
    const alpha = place({
      id: 2,
      name: "Alpha",
      visit_date: "2026-06-01",
      visit_time: "foo",
    });

    expect(compareScheduledPlaces(zebra, alpha)).toBeGreaterThan(0);
    expect(compareScheduledPlaces(alpha, zebra)).toBeLessThan(0);
  });
});

describe("buildItinerary", () => {
  it("creates empty itinerary days from a valid trip period", () => {
    const result = buildItinerary([], [], [], {
      startDate: "2026-06-01",
      endDate: "2026-06-03",
    });

    expect(result.days.map((day) => [day.date, day.items])).toEqual([
      ["2026-06-01", []],
      ["2026-06-02", []],
      ["2026-06-03", []],
    ]);
  });

  it("keeps existing out-of-range visits visible after the trip-period days", () => {
    const result = buildItinerary(
      [
        place({
          id: 1,
          name: "Inside",
          visit_date: "2026-06-02",
        }),
        place({
          id: 2,
          name: "Outside",
          visit_date: "2026-06-05",
        }),
      ],
      [],
      [],
      {
        startDate: "2026-06-01",
        endDate: "2026-06-03",
      },
    );

    expect(
      result.days.map((day) => ({
        date: day.date,
        names: day.items.map((item) => item.place.name),
      })),
    ).toEqual([
      { date: "2026-06-01", names: [] },
      { date: "2026-06-02", names: ["Inside"] },
      { date: "2026-06-03", names: [] },
      { date: "2026-06-05", names: ["Outside"] },
    ]);
  });

  it("groups scheduled places by date with timed places before untimed places", () => {
    const result = buildItinerary(
      [
        place({ id: 1, name: "Guggenheim", visit_date: "2026-06-01" }),
        place({
          id: 2,
          name: "A Stop",
          visit_date: "2026-06-01",
          visit_time: "11:00",
        }),
        place({
          id: 3,
          name: "B Stop",
          visit_date: "2026-06-01",
          visit_time: "09:00",
        }),
        place({ id: 4, name: "Central Park", visit_date: "2026-06-01" }),
      ],
      [],
    );

    expect(result.days).toHaveLength(1);
    expect(result.days[0].items.map((item) => item.place.name)).toEqual([
      "B Stop",
      "A Stop",
      "Central Park",
      "Guggenheim",
    ]);
  });

  it("sorts timed places with the same time by name", () => {
    const result = buildItinerary(
      [
        place({
          id: 1,
          name: "Zoo",
          visit_date: "2026-06-01",
          visit_time: "09:00",
        }),
        place({
          id: 2,
          name: "Aquarium",
          visit_date: "2026-06-01",
          visit_time: "09:00",
        }),
        place({
          id: 3,
          name: "Museum",
          visit_date: "2026-06-01",
          visit_time: "10:00",
        }),
      ],
      [],
    );

    expect(result.days[0].items.map((item) => item.place.name)).toEqual([
      "Aquarium",
      "Zoo",
      "Museum",
    ]);
  });

  it("keeps unscheduled places separate and alphabetized", () => {
    const zoo = place({ id: 1, name: "Zoo" });
    const aquarium = place({ id: 2, name: "Aquarium" });
    const museum = place({
      id: 3,
      name: "Museum",
      visit_date: "2026-06-02",
      visit_time: "10:00",
    });
    const result = buildItinerary(
      [museum],
      [],
      [zoo.place, aquarium.place, museum.place],
    );

    expect(result.unscheduled.map((item) => item.name)).toEqual([
      "Aquarium",
      "Zoo",
    ]);
    expect(result.days[0].date).toBe("2026-06-02");
  });

  it("assigns sorted dates a fixed accessible palette that cycles after seven days", () => {
    const result = buildItinerary(
      [
        place({
          id: 1,
          name: "A",
          visit_date: "2026-06-01",
          visit_time: "09:00",
        }),
        place({
          id: 2,
          name: "B",
          visit_date: "2026-06-08",
          visit_time: "10:00",
        }),
        place({
          id: 3,
          name: "C",
          visit_date: "2026-06-03",
          visit_time: "11:00",
        }),
        place({
          id: 4,
          name: "D",
          visit_date: "2026-06-02",
          visit_time: "12:00",
        }),
        place({
          id: 5,
          name: "E",
          visit_date: "2026-06-04",
          visit_time: "13:00",
        }),
        place({
          id: 6,
          name: "F",
          visit_date: "2026-06-05",
          visit_time: "14:00",
        }),
        place({
          id: 7,
          name: "G",
          visit_date: "2026-06-06",
          visit_time: "15:00",
        }),
        place({
          id: 8,
          name: "H",
          visit_date: "2026-06-07",
          visit_time: "16:00",
        }),
      ],
      [],
    );

    expect(result.days.map((day) => [day.date, day.color])).toEqual([
      ["2026-06-01", "#dc2626"],
      ["2026-06-02", "#d6a100"],
      ["2026-06-03", "#15803d"],
      ["2026-06-04", "#2563eb"],
      ["2026-06-05", "#7c3aed"],
      ["2026-06-06", "#0f766e"],
      ["2026-06-07", "#be185d"],
      ["2026-06-08", "#dc2626"],
    ]);
  });

  it("attaches route segments for matching consecutive timed place pairs", () => {
    const segments: RouteSegment[] = [
      {
        id: 20,
        trip_id: 1,
        from_item_id: 1,
        to_item_id: 2,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
      {
        id: 21,
        trip_id: 1,
        from_item_id: 2,
        to_item_id: 3,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
    ];

    const result = buildItinerary(
      [
        place({
          id: 1,
          name: "A",
          visit_date: "2026-06-01",
          visit_time: "09:00",
        }),
        place({
          id: 2,
          name: "B",
          visit_date: "2026-06-01",
          visit_time: "10:00",
        }),
        place({
          id: 3,
          name: "C",
          visit_date: "2026-06-01",
          visit_time: "11:00",
        }),
      ],
      segments,
    );

    expect(result.days[0].segments).toEqual([
      {
        fromItemId: 1,
        toItemId: 2,
        segment: segments[0],
      },
      {
        fromItemId: 2,
        toItemId: 3,
        segment: segments[1],
      },
    ]);
  });

  it("excludes non-consecutive timed route segments even when they exist", () => {
    const segments: RouteSegment[] = [
      {
        id: 20,
        trip_id: 1,
        from_item_id: 1,
        to_item_id: 2,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
      {
        id: 21,
        trip_id: 1,
        from_item_id: 1,
        to_item_id: 3,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
    ];

    const result = buildItinerary(
      [
        place({
          id: 1,
          name: "A",
          visit_date: "2026-06-01",
          visit_time: "09:00",
        }),
        place({
          id: 2,
          name: "B",
          visit_date: "2026-06-01",
          visit_time: "10:00",
        }),
        place({
          id: 3,
          name: "C",
          visit_date: "2026-06-01",
          visit_time: "11:00",
        }),
      ],
      segments,
    );

    expect(result.days[0].segments).toEqual([
      {
        fromItemId: 1,
        toItemId: 2,
        segment: segments[0],
      },
    ]);
    expect(result.days[0].segments).not.toContainEqual({
      fromItemId: 1,
      toItemId: 3,
      segment: segments[1],
    });
  });

  it("ignores malformed visit times when constructing route segments", () => {
    const segments: RouteSegment[] = [
      {
        id: 20,
        trip_id: 1,
        from_item_id: 1,
        to_item_id: 2,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
      {
        id: 21,
        trip_id: 1,
        from_item_id: 2,
        to_item_id: 3,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
      {
        id: 22,
        trip_id: 1,
        from_item_id: 1,
        to_item_id: 3,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
      {
        id: 23,
        trip_id: 1,
        from_item_id: 3,
        to_item_id: 2,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
    ];

    const result = buildItinerary(
      [
        place({
          id: 1,
          name: "A",
          visit_date: "2026-06-01",
          visit_time: "09:00",
        }),
        place({
          id: 2,
          name: "B",
          visit_date: "2026-06-01",
          visit_time: "foo",
        }),
        place({
          id: 3,
          name: "C",
          visit_date: "2026-06-01",
          visit_time: "10:00",
        }),
      ],
      segments,
    );

    expect(result.days[0].segments).toEqual([
      {
        fromItemId: 1,
        toItemId: 3,
        segment: segments[2],
      },
    ]);
    expect(result.days[0].segments).not.toContainEqual({
      fromItemId: 3,
      toItemId: 2,
      segment: segments[3],
    });
  });
});
