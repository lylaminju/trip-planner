import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AddEditPlaceModal } from "@/components/AddEditPlaceModal";
import { EditItineraryItemModal } from "@/components/EditItineraryItemModal";
import type { ItineraryItem, Place, VisitDateOption } from "@/lib/types";

const visitDateOptions: VisitDateOption[] = [
  { value: "2026-06-01", label: "Day 1 · Jun 1, 2026" },
  { value: "2026-06-02", label: "Day 2 · Jun 2, 2026" },
];

describe("visit date controls", () => {
  it("uses a valid trip-day select when adding an initial visit", () => {
    const markup = renderToStaticMarkup(
      createElement(AddEditPlaceModal, {
        place: null,
        visitDateOptions,
        onCancel: vi.fn(),
        onSave: vi.fn(),
      }),
    );

    expect(markup).toContain('<select name="visit_date"');
    expect(markup).toContain("Day 1 · Jun 1, 2026");
    expect(markup).not.toContain('type="date" name="visit_date"');
  });

  it("keeps an existing out-of-range visit date without offering free date entry", () => {
    const markup = renderToStaticMarkup(
      createElement(EditItineraryItemModal, {
        item: itineraryItem({
          visit_date: "2026-06-05",
          place: place({ name: "Late stop" }),
        }),
        visitDateOptions,
        onCancel: vi.fn(),
        onSave: vi.fn(),
      }),
    );

    expect(markup).toContain("Current date: Jun 5, 2026");
    expect(markup).not.toContain('type="date" name="visit_date"');
  });

  it("does not offer free date entry when trip dates are not confirmed", () => {
    const markup = renderToStaticMarkup(
      createElement(AddEditPlaceModal, {
        place: null,
        visitDateOptions: [],
        onCancel: vi.fn(),
        onSave: vi.fn(),
      }),
    );

    expect(markup).toContain("Set trip dates first");
    expect(markup).toContain("disabled");
    expect(markup).not.toContain('type="date" name="visit_date"');
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
