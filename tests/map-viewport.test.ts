import { describe, expect, it } from "vitest";

import {
  getSelectedDatePositions,
  getSelectedPlacePosition,
  getSelectedSegmentPositions,
} from "@/lib/map-viewport";
import type { ItineraryItem, Place, RouteSegment } from "@/lib/types";

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

describe("getSelectedDatePositions", () => {
  it("returns coordinates only for the requested date", () => {
    expect(
      getSelectedDatePositions(
        [
          item({
            id: 1,
            visit_date: "2026-06-10",
            place: place({ id: 1, latitude: 40.7, longitude: -73.9 }),
          }),
          item({
            id: 2,
            visit_date: "2026-06-11",
            place: place({ id: 2, latitude: 40.76, longitude: -73.98 }),
          }),
          item({
            id: 3,
            visit_date: "2026-06-10",
            place: place({ id: 3, latitude: 40.74, longitude: -73.95 }),
          }),
        ],
        "2026-06-10",
      ),
    ).toEqual([
      { lat: 40.7, lng: -73.9 },
      { lat: 40.74, lng: -73.95 },
    ]);
  });

  it("includes a matching item when visit_time is null", () => {
    expect(
      getSelectedDatePositions(
        [
          item({
            id: 1,
            visit_date: "2026-06-10",
            visit_time: null,
            place: place({ id: 1, latitude: 40.7, longitude: -73.9 }),
          }),
        ],
        "2026-06-10",
      ),
    ).toEqual([{ lat: 40.7, lng: -73.9 }]);
  });

  it("returns one coordinate for a single-place date", () => {
    expect(
      getSelectedDatePositions(
        [
          item({
            id: 1,
            visit_date: "2026-06-10",
            place: place({ id: 1, latitude: 40.7, longitude: -73.9 }),
          }),
        ],
        "2026-06-10",
      ),
    ).toEqual([{ lat: 40.7, lng: -73.9 }]);
  });

  it("returns an empty array when activeDate is null", () => {
    expect(getSelectedDatePositions([item({ id: 1 })], null)).toEqual([]);
  });

  it("returns an empty array when the date is missing", () => {
    expect(
      getSelectedDatePositions(
        [
          item({
            id: 1,
            visit_date: "2026-06-10",
            place: place({ id: 1, latitude: 40.7, longitude: -73.9 }),
          }),
        ],
        "2026-06-11",
      ),
    ).toEqual([]);
  });
});

describe("getSelectedSegmentPositions", () => {
  it("returns endpoint coordinates for the selected route segment", () => {
    expect(
      getSelectedSegmentPositions(
        [
          item({
            id: 10,
            place: place({ id: 1, latitude: 40.7128, longitude: -74.006 }),
          }),
          item({
            id: 20,
            place: place({ id: 2, latitude: 40.758, longitude: -73.9855 }),
          }),
        ],
        [segment({ id: 7, from_item_id: 10, to_item_id: 20 })],
        7,
      ),
    ).toEqual([
      { lat: 40.7128, lng: -74.006 },
      { lat: 40.758, lng: -73.9855 },
    ]);
  });

  it("returns no endpoint coordinates when there is no selected route segment", () => {
    expect(
      getSelectedSegmentPositions(
        [item({ id: 10 }), item({ id: 20 })],
        [segment({ id: 7, from_item_id: 10, to_item_id: 20 })],
        null,
      ),
    ).toEqual([]);
  });

  it("returns no endpoint coordinates when an endpoint item is missing", () => {
    expect(
      getSelectedSegmentPositions(
        [item({ id: 10 })],
        [segment({ id: 7, from_item_id: 10, to_item_id: 20 })],
        7,
      ),
    ).toEqual([]);
  });
});

function place(overrides: Partial<Place>): Place {
  return {
    id: 1,
    trip_id: 1,
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
    links: [],
    image_url: null,
    image_credit: null,
    created_at: "2026-05-20 00:00:00",
    updated_at: "2026-05-20 00:00:00",
    ...overrides,
  };
}

function segment(overrides: Partial<RouteSegment>): RouteSegment {
  return {
    id: 1,
    trip_id: 1,
    from_item_id: 1,
    to_item_id: 2,
    mode: "walking",
    created_at: "2026-05-20 00:00:00",
    updated_at: "2026-05-20 00:00:00",
    ...overrides,
  };
}

function item(overrides: Partial<ItineraryItem>): ItineraryItem {
  return {
    id: 1,
    trip_id: 1,
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
