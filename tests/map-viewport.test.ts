import { describe, expect, it } from "vitest";

import { getSelectedPlacePosition } from "@/lib/map-viewport";
import type { ItineraryItem, Place } from "@/lib/types";

describe("getSelectedPlacePosition", () => {
  it("returns the selected place coordinates for map centering", () => {
    expect(
      getSelectedPlacePosition(
        [
          item({
            id: 1,
            place: place({ id: 1, latitude: 40.7, longitude: -73.9 }),
          }),
          item({
            id: 2,
            place: place({ id: 2, latitude: 40.76, longitude: -73.98 }),
          }),
        ],
        [],
        2,
      ),
    ).toEqual({ lat: 40.76, lng: -73.98 });
  });

  it("returns null when there is no selected place", () => {
    expect(getSelectedPlacePosition([item({ id: 1 })], [], null)).toBeNull();
  });

  it("returns unscheduled place coordinates for map centering", () => {
    expect(
      getSelectedPlacePosition(
        [item({ id: 1 })],
        [place({ id: 4, latitude: 41, longitude: -75 })],
        null,
        4,
      ),
    ).toEqual({ lat: 41, lng: -75 });
  });
});

function place(overrides: Partial<Place>): Place {
  return {
    id: 1,
    name: "Place",
    address: null,
    google_maps_url: "https://www.google.com/maps",
    place_id: null,
    google_place_token: null,
    google_internal_ids: null,
    source_list_url: null,
    latitude: 40,
    longitude: -74,
    notes: null,
    created_at: "2026-05-20 00:00:00",
    updated_at: "2026-05-20 00:00:00",
    ...overrides,
  };
}

function item(overrides: Partial<ItineraryItem>): ItineraryItem {
  return {
    id: 1,
    place_id: 1,
    visit_date: null,
    visit_time: null,
    notes: null,
    created_at: "2026-05-20 00:00:00",
    updated_at: "2026-05-20 00:00:00",
    place: place({ id: 1 }),
    ...overrides,
  };
}
