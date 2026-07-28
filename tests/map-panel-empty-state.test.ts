import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MapPanel } from "@/components/MapPanel";
import type { ItineraryView } from "@/lib/types";

describe("MapPanel empty state", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  });

  it("shows a concise empty map state when the trip has no places", () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-key";
    const itinerary: ItineraryView = { days: [], unscheduled: [] };

    const markup = renderToStaticMarkup(
      createElement(MapPanel, mapPanelProps(itinerary)),
    );

    const css = readFileSync("src/styles/components/map.css", "utf8");

    expect(markup).not.toContain("No places yet");
    expect(markup).toContain("Add place");
    expect(markup).toContain("Add your first place to start building the map.");
    expect(css).not.toContain(".map-empty-state-title");
  });

  it("keeps empty-state actions in one row", () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-key";
    const itinerary: ItineraryView = { days: [], unscheduled: [] };

    const markup = renderToStaticMarkup(
      createElement(MapPanel, {
        ...mapPanelProps(itinerary),
        onPlanWithAi: vi.fn(),
      }),
    );
    const actions = markupBetween(markup, "map-empty-state-actions", "div");
    const css = readFileSync("src/styles/components/map.css", "utf8");
    const rule = cssRule(css, ".map-empty-state-actions");

    expect(actions).toContain("Add place");
    expect(actions).toContain("Plan with AI");
    expect(actions).toContain("magic-wand-svg");
    expect(rule).toContain("display: flex;");
    expect(rule).toContain("justify-content: center;");
  });
});

function mapPanelProps(itinerary: ItineraryView) {
  return {
    itinerary,
    destinationFocus: null,
    routeSegments: [],
    selection: {
      activeItemId: null,
      activeCanonicalPlaceId: null,
      activeSegmentId: null,
      activeDate: null,
      selectItem: vi.fn(),
      toggleSegmentSelection: vi.fn(),
      clearSelection: vi.fn(),
    },
    modals: {
      openAddModal: vi.fn(),
      openAddModalWithSelection: vi.fn(),
      openEditModal: vi.fn(),
      openEditItemModal: vi.fn(),
    },
    mobileSheetState: "half" as const,
    routeGeometries: new Map(),
    routeGeometryError: null,
    currentLocation: {
      currentLocationPosition: null,
      currentLocationToast: null,
      isCurrentLocationEnabled: false,
      toggleCurrentLocation: vi.fn(),
    },
    canShowCurrentLocation: false,
    canEdit: true,
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

function cssRule(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n}", start);
  expect(end).toBeGreaterThanOrEqual(0);

  return css.slice(start, end + 2);
}
