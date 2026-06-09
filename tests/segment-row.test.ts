import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SegmentRow } from "@/components/SegmentRow";
import type { Place, RouteSegment } from "@/lib/types";

describe("SegmentRow", () => {
  it("renders the selected travel mode as an icon-only trigger", () => {
    const markup = renderToStaticMarkup(
      createElement(SegmentRow, {
        segment: routeSegment({ mode: "walking" }),
        from: place({ name: "Cafe" }),
        to: place({ id: 2, name: "Museum" }),
        active: false,
        durationSeconds: 18 * 60,
        canEdit: true,
        onSelect: vi.fn(),
        onModeChange: vi.fn(),
      }),
    );

    expect(markup).toContain('class="route-mode-trigger"');
    expect(markup).toContain('aria-label="Travel mode: Walking"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("route-mode-chevron");
    expect(markup).toContain("<svg");
    expect(markup).not.toContain("<select");
    expect(markup).not.toContain(">walking<");
    expect(markup).toContain("18 min");
    expect(markup).toContain("api=1");
    expect(markup).toContain("travelmode=walking");
  });

  it("disables the mode trigger for read-only planners without hiding duration", () => {
    const markup = renderToStaticMarkup(
      createElement(SegmentRow, {
        segment: routeSegment({ mode: "transit" }),
        from: place({ name: "Cafe" }),
        to: place({ id: 2, name: "Museum" }),
        active: false,
        durationSeconds: 22 * 60,
        canEdit: false,
        onSelect: vi.fn(),
        onModeChange: vi.fn(),
      }),
    );

    expect(markup).toContain('aria-label="Travel mode: Transit"');
    expect(markup).toContain("disabled");
    expect(markup).toContain("22 min");
    expect(markup).toContain("travelmode=transit");
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

function routeSegment(
  overrides: Partial<RouteSegment> = {},
): RouteSegment {
  return {
    id: overrides.id ?? 10,
    trip_id: overrides.trip_id ?? 1,
    from_item_id: overrides.from_item_id ?? 1,
    to_item_id: overrides.to_item_id ?? 2,
    mode: overrides.mode ?? "walking",
    created_at: overrides.created_at ?? "2026-05-20 00:00:00",
    updated_at: overrides.updated_at ?? "2026-05-20 00:00:00",
  };
}
