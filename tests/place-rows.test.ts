import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  ItineraryItemRow,
  PlaceListRow,
} from "@/components/planner-panel/PlaceRows";
import type { ItineraryItem, Place } from "@/lib/types";

describe("PlaceRows", () => {
  it("disables a place delete button and replaces the trash icon while deleting", () => {
    const markup = renderToStaticMarkup(
      createElement(PlaceListRow, {
        place: place({ id: 7, name: "Bryant Park" }),
        active: false,
        canEdit: true,
        isDeleting: true,
        onSelect: vi.fn(),
        onEdit: vi.fn(),
        onAddVisit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(markup).toContain('aria-label="Deleting place Bryant Park"');
    expect(markup).toContain("disabled");
    expect(markup).toContain("delete-loading-spinner");
    expect(markup).not.toContain("M4 7h16");
  });

  it("disables an itinerary item delete button and replaces the trash icon while deleting", () => {
    const markup = renderToStaticMarkup(
      createElement(ItineraryItemRow, {
        item: itineraryItem({
          id: 11,
          place: place({ id: 7, name: "Bryant Park" }),
        }),
        active: false,
        markerLabel: null,
        markerColor: "#0f766e",
        canEdit: true,
        isDeleting: true,
        onSelect: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(markup).toContain('aria-label="Deleting visit to Bryant Park"');
    expect(markup).toContain("disabled");
    expect(markup).toContain("delete-loading-spinner");
    expect(markup).not.toContain("M4 7h16");
  });
});

function place(overrides: Partial<Place> = {}): Place {
  return {
    id: overrides.id ?? 1,
    trip_id: overrides.trip_id ?? 1,
    name: overrides.name ?? "Place",
    address: overrides.address ?? null,
    google_maps_url:
      overrides.google_maps_url ?? "https://www.google.com/maps/place",
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
}

function itineraryItem(
  overrides: Partial<ItineraryItem> & { place: Place },
): ItineraryItem {
  return {
    id: overrides.id ?? 1,
    trip_id: overrides.trip_id ?? 1,
    place_id: overrides.place_id ?? overrides.place.id,
    place: overrides.place,
    visit_date: overrides.visit_date ?? "2026-06-01",
    visit_time: overrides.visit_time ?? "09:00",
    notes: overrides.notes ?? null,
    created_at: overrides.created_at ?? "2026-05-20 00:00:00",
    updated_at: overrides.updated_at ?? "2026-05-20 00:00:00",
  };
}
