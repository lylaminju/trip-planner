import { describe, expect, it } from "vitest";

import { buildTimedMarkerLabels, getMarkerSizing } from "@/lib/map-marker-labels";
import type { ItineraryItem, ItineraryView, Place } from "@/lib/types";

describe("buildTimedMarkerLabels", () => {
  it("labels timed places by their order in each itinerary day", () => {
    const labels = buildTimedMarkerLabels({
      days: [
        {
          date: "2026-06-01",
          color: "#111111",
          items: [
            place({ id: 10, visit_time: "09:00" }),
            place({ id: 11, visit_time: "10:00" }),
            place({ id: 12, visit_time: null }),
          ],
          segments: [],
        },
        {
          date: "2026-06-02",
          color: "#222222",
          items: [
            place({ id: 20, visit_time: "08:00" }),
            place({ id: 21, visit_time: null }),
          ],
          segments: [],
        },
      ],
      unscheduled: [canonicalPlace({ id: 30 })],
    });

    expect(Object.fromEntries(labels)).toEqual({
      10: "1",
      11: "2",
      20: "1",
    });
  });
});

describe("getMarkerSizing", () => {
  it("increases marker size as the map zooms in", () => {
    expect(getMarkerSizing(11)).toEqual({
      size: 16,
      activeSize: 22,
      fontSize: 10,
      activeFontSize: 12,
    });
    expect(getMarkerSizing(16)).toEqual({
      size: 24,
      activeSize: 32,
      fontSize: 12,
      activeFontSize: 14,
    });
  });
});

function place(overrides: Partial<ItineraryItem>): ItineraryItem {
  return {
    id: 1,
    place_id: 1,
    visit_date: "2026-06-01",
    visit_time: null,
    notes: null,
    created_at: "2026-05-20 00:00:00",
    updated_at: "2026-05-20 00:00:00",
    place: {
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
    },
    ...overrides,
  };
}

function canonicalPlace(overrides: Partial<Place>): Place {
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

const _typeCheck: ItineraryView | null = null;
void _typeCheck;
