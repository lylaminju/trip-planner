import { describe, expect, it } from "vitest";

import { formatItineraryDateHeading, formatPlaceRow } from "@/lib/place-display";
import type { Place } from "@/lib/types";

describe("formatPlaceRow", () => {
  it("shows itinerary time before the place name without repeating the date", () => {
    expect(
      formatPlaceRow(place({ name: "LaGuardia Airport", visit_date: "2026-06-01", visit_time: "10:00" }), {
        context: "itinerary",
      }),
    ).toEqual({
      title: "LaGuardia Airport",
      detail: null,
      timePrefix: "10:00",
    });
  });

  it("shows itinerary place names without a no-time label", () => {
    expect(
      formatPlaceRow(place({ name: "Bryant Park", visit_date: "2026-06-01", visit_time: null }), {
        context: "itinerary",
      }),
    ).toEqual({
      title: "Bryant Park",
      detail: null,
      timePrefix: null,
    });
  });

  it("keeps schedule context outside date buckets", () => {
    expect(
      formatPlaceRow(place({ name: "LaGuardia Airport", visit_date: "2026-06-01", visit_time: "10:00" }), {
        context: "default",
      }),
    ).toEqual({
      title: "LaGuardia Airport",
      detail: "2026-06-01 10:00",
      timePrefix: null,
    });
  });
});

describe("formatItineraryDateHeading", () => {
  it("adds the weekday next to an itinerary date", () => {
    expect(formatItineraryDateHeading("2026-06-01")).toBe("2026-06-01 Monday");
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
    visit_date: null,
    visit_time: null,
    notes: null,
    created_at: "2026-05-20 00:00:00",
    updated_at: "2026-05-20 00:00:00",
    ...overrides,
  };
}
