import { createElement } from "react";
import { readFileSync } from "node:fs";
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
        canAddVisit: true,
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

  it("disables add visit when trip dates are not confirmed", () => {
    const markup = renderToStaticMarkup(
      createElement(PlaceListRow, {
        place: place({ id: 7, name: "Bryant Park" }),
        active: false,
        canEdit: true,
        canAddVisit: false,
        isDeleting: false,
        onSelect: vi.fn(),
        onEdit: vi.fn(),
        onAddVisit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(markup).toContain(
      'aria-label="Set trip dates before adding Bryant Park to itinerary"',
    );
    expect(markup).toContain("disabled");
  });

  it("styles drag handles as borderless row affordances", () => {
    const css = readFileSync(
      "src/styles/components/planner-place-rows.css",
      "utf8",
    );
    const rule = cssRule(css, ".drag-handle");

    expect(rule).toContain("background: transparent;");
    expect(rule).toContain("border: 0;");
    expect(rule).toContain("border-radius: 6px;");
    expect(rule).toContain("padding: 0;");
    expect(rule).toContain("flex: 0 0 32px;");
  });
});

function cssRule(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n}", start);
  expect(end).toBeGreaterThanOrEqual(0);

  return css.slice(start, end + 2);
}

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
