import { describe, expect, it } from "vitest";

import {
  formatItineraryDateHeading,
  formatPlaceRow,
} from "@/lib/place-display";
import type { ItineraryItem, Place } from "@/lib/types";

describe("formatPlaceRow", () => {
  it("shows itinerary time before the place name without repeating the date", () => {
    expect(
      formatPlaceRow(
        place({
          name: "LaGuardia Airport",
          visit_date: "2026-06-01",
          visit_time: "10:00",
        }),
        {
          context: "itinerary",
        },
      ),
    ).toEqual({
      title: "LaGuardia Airport",
      detail: null,
      timePrefix: "10:00",
    });
  });

  it("shows itinerary place names without a no-time label", () => {
    expect(
      formatPlaceRow(
        place({
          name: "Bryant Park",
          visit_date: "2026-06-01",
          visit_time: null,
        }),
        {
          context: "itinerary",
        },
      ),
    ).toEqual({
      title: "Bryant Park",
      detail: null,
      timePrefix: null,
    });
  });

  it("keeps schedule context outside date buckets", () => {
    expect(
      formatPlaceRow(
        place({
          name: "LaGuardia Airport",
          visit_date: "2026-06-01",
          visit_time: "10:00",
        }),
        {
          context: "default",
        },
      ),
    ).toEqual({
      title: "LaGuardia Airport",
      detail: "2026-06-01 10:00",
      timePrefix: null,
    });
  });

  it("treats canonical places with legacy schedule columns as places", () => {
    const legacyPlace = {
      id: 1,
      name: "Legacy Hotel",
      address: "123 Main St",
      google_maps_url: "https://www.google.com/maps",
      place_id: null,
      google_place_token: null,
      google_internal_ids: null,
      source_list_url: null,
      latitude: 40,
      longitude: -74,
      notes: null,
      links: [],
      created_at: "2026-05-20 00:00:00",
      updated_at: "2026-05-20 00:00:00",
      visit_date: "2026-06-01",
      visit_time: "09:00",
    } as unknown as Place;

    expect(formatPlaceRow(legacyPlace)).toEqual({
      title: "Legacy Hotel",
      detail: null,
      timePrefix: null,
    });
  });

  it("hides place addresses in the places list", () => {
    const placeOnly = {
      id: 2,
      trip_id: 1,
      name: "Bryant Park",
      address: "New York, NY",
      google_maps_url: "https://www.google.com/maps",
      place_id: null,
      google_place_token: null,
      google_internal_ids: null,
      source_list_url: null,
      latitude: 40,
      longitude: -74,
      notes: "Lawn and fountain",
      links: [],
      created_at: "2026-05-20 00:00:00",
      updated_at: "2026-05-20 00:00:00",
    } as Place;

    expect(formatPlaceRow(placeOnly)).toEqual({
      title: "Bryant Park",
      detail: null,
      timePrefix: null,
    });
  });
});

describe("formatItineraryDateHeading", () => {
  it("adds the weekday next to a month-day itinerary date", () => {
    expect(formatItineraryDateHeading("2026-06-01")).toBe("06-01 Mon");
  });
});

function place(
  overrides: Partial<Place> &
    Partial<Pick<ItineraryItem, "visit_date" | "visit_time">>,
): ItineraryItem {
  const canonicalPlace: Place = {
    id: 1,
    trip_id: 1,
    name: overrides.name ?? "Place",
    address: overrides.address ?? null,
    google_maps_url: overrides.google_maps_url ?? "https://www.google.com/maps",
    place_id: overrides.place_id ?? null,
    google_place_token: overrides.google_place_token ?? null,
    google_internal_ids: overrides.google_internal_ids ?? null,
    source_list_url: overrides.source_list_url ?? null,
    latitude: overrides.latitude ?? 40,
    longitude: overrides.longitude ?? -74,
    notes: overrides.notes ?? null,
    links: overrides.links ?? [],
    created_at: overrides.created_at ?? "2026-05-20 00:00:00",
    updated_at: overrides.updated_at ?? "2026-05-20 00:00:00",
  };

  return {
    id: 1,
    trip_id: canonicalPlace.trip_id,
    place_id: canonicalPlace.id,
    visit_date: overrides.visit_date ?? null,
    visit_time: overrides.visit_time ?? null,
    notes: null,
    created_at: canonicalPlace.created_at,
    updated_at: canonicalPlace.updated_at,
    place: canonicalPlace,
  };
}
