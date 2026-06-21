import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PlannerPanel } from "@/components/PlannerPanel";
import type { ItineraryView, Place } from "@/lib/types";

describe("PlannerPanel view toggle", () => {
  it("offers Expand with right chevrons from the split planner and map view", () => {
    const markup = renderToStaticMarkup(
      createElement(PlannerPanel, plannerPanelProps({ isExpanded: false })),
    );
    const buttonMarkup = markupBetween(markup, "panel-expand-toggle", "button");

    expect(buttonMarkup).toContain("Expand");
    expect(buttonMarkup).toContain('aria-label="Expand planner and hide map"');
    expect(buttonMarkup).toContain("panel-expand-toggle-icon");
    expect(buttonMarkup).toContain("<svg");
    expect(buttonMarkup.indexOf("<span>Expand</span>")).toBeLessThan(
      buttonMarkup.indexOf('<span class="panel-expand-toggle-icon"'),
    );
  });

  it("offers Collapse with left chevrons from the planner-only view", () => {
    const markup = renderToStaticMarkup(
      createElement(PlannerPanel, plannerPanelProps({ isExpanded: true })),
    );
    const buttonMarkup = markupBetween(markup, "panel-expand-toggle", "button");

    expect(buttonMarkup).toContain("Collapse");
    expect(buttonMarkup).toContain('aria-label="Collapse planner and show map"');
    expect(buttonMarkup).toContain("panel-expand-toggle-icon");
    expect(buttonMarkup).toContain("<svg");
    expect(
      buttonMarkup.indexOf('<span class="panel-expand-toggle-icon"'),
    ).toBeLessThan(buttonMarkup.indexOf("<span>Collapse</span>"));
  });
});

function plannerPanelProps(overrides: { isExpanded: boolean }) {
  return {
    title: "Tokyo Spring",
    tripPeriodLabel: "Apr 1 - 7, 2026",
    itinerary: itinerary(),
    places: [],
    activePlaceId: null,
    activeCanonicalPlaceId: null,
    activeSegmentId: null,
    activeDate: null,
    collapsedDates: new Set<string>(),
    routeGeometries: new Map(),
    error: null,
    exportFeedback: null,
    isExpanded: overrides.isExpanded,
    mobileSheetState: "half" as const,
    canEdit: true,
    canAddVisits: true,
    deletingPlaceIds: new Set<number>(),
    deletingItineraryItemIds: new Set<number>(),
    onToggleExpanded: vi.fn(),
    onMobileSheetStateChange: vi.fn(),
    onAdd: vi.fn(),
    onEditTrip: vi.fn(),
    onCopyExport: vi.fn(),
    onDownloadExport: vi.fn(),
    onAddVisit: vi.fn(),
    onEdit: vi.fn(),
    onEditItem: vi.fn(),
    onDelete: vi.fn(),
    onSelectPlace: vi.fn(),
    onSelectCanonicalPlace: vi.fn(),
    onSelectSegment: vi.fn(),
    onToggleDateCollapsed: vi.fn(),
    onSelectDate: vi.fn(),
    onSchedulePlace: vi.fn(),
    onScheduleItem: vi.fn(),
    onModeChange: vi.fn(),
    onDeleteItem: vi.fn(),
  };
}

function markupBetween(markup: string, className: string, tag: string) {
  const start = markup.indexOf(className);
  expect(start).toBeGreaterThanOrEqual(0);
  const elementStart = markup.lastIndexOf(`<${tag}`, start);
  const elementEnd = markup.indexOf(`</${tag}>`, start);
  expect(elementStart).toBeGreaterThanOrEqual(0);
  expect(elementEnd).toBeGreaterThanOrEqual(0);

  return markup.slice(elementStart, elementEnd + tag.length + 3);
}

function itinerary(): ItineraryView {
  return {
    days: [
      {
        date: "2026-04-01",
        color: "var(--accent)",
        items: [],
        segments: [],
      },
    ],
    unscheduled: [place()],
  };
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
