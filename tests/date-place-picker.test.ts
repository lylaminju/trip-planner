import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DatePlacePicker } from "@/components/planner-panel/DatePlacePicker";
import type { Place } from "@/lib/types";

describe("DatePlacePicker", () => {
  it("offers new place creation before the existing place list", () => {
    const markup = renderToStaticMarkup(
      createElement(DatePlacePicker, {
        date: "2026-06-01",
        places: [place({ name: "Existing cafe" })],
        style: {},
        onClose: vi.fn(),
        onCreatePlace: vi.fn(),
        onSelect: vi.fn(),
      }),
    );

    expect(markup).toContain("New place");
    expect(markup.indexOf("New place")).toBeLessThan(
      markup.indexOf("Existing cafe"),
    );
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
