import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ChevronRightIcon } from "@/components/Icons";
import { ItinerarySection } from "@/components/planner-panel/ItinerarySection";
import { SectionToggle } from "@/components/planner-panel/SectionToggle";
import type { ItineraryView, Place } from "@/lib/types";

describe("planner collapse controls", () => {
  it("uses a sharper chevron geometry for collapse icons", () => {
    const markup = renderToStaticMarkup(createElement(ChevronRightIcon));

    expect(markup).toContain('d="M8 19 16 12 8 5"');
  });

  it("renders section toggles with an svg chevron instead of text glyphs", () => {
    const markup = renderToStaticMarkup(
      createElement(SectionToggle, {
        title: "Itineraries",
        open: true,
        onToggle: vi.fn(),
      }),
    );
    const iconMarkup = markupBetween(markup, "section-toggle-icon", "span");

    expect(iconMarkup).toContain("<svg");
    expect(iconMarkup).not.toContain(">v<");
    expect(iconMarkup).not.toContain("&gt;");
  });

  it("keeps section titles outside the collapse button", () => {
    const markup = renderToStaticMarkup(
      createElement(SectionToggle, {
        title: "Itineraries",
        open: true,
        onToggle: vi.fn(),
      }),
    );
    const buttonMarkup = markupBetween(
      markup,
      "section-toggle-button",
      "button",
    );

    expect(buttonMarkup).toContain('aria-label="Collapse Itineraries"');
    expect(buttonMarkup).not.toContain("<h2>");
    expect(markup).toContain("</button><h2>Itineraries</h2>");
  });

  it("renders itinerary day collapse buttons with svg chevrons in both states", () => {
    const openMarkup = dayCollapseButtonMarkup(new Set());
    const collapsedMarkup = dayCollapseButtonMarkup(new Set(["2026-06-01"]));

    expect(openMarkup).toContain('aria-expanded="true"');
    expect(openMarkup).toContain("<svg");
    expect(openMarkup).not.toContain(">v<");

    expect(collapsedMarkup).toContain('aria-expanded="false"');
    expect(collapsedMarkup).toContain("<svg");
    expect(collapsedMarkup).not.toContain("&gt;");
  });

  it("places itinerary day collapse buttons before the date heading", () => {
    const markup = itinerarySectionMarkup(new Set());

    expect(markup.indexOf('class="day-collapse-button"')).toBeLessThan(
      markup.indexOf('class="day-heading-button"'),
    );
  });

  it("colors the day prefix instead of rendering a separate color marker", () => {
    const markup = itinerarySectionMarkup(new Set());
    const dayPrefixMarkup = markupBetween(markup, "day-heading-prefix", "span");

    expect(markup).not.toContain("day-heading-color-label");
    expect(dayPrefixMarkup).toContain('style="color:var(--accent)"');
  });

  it("keeps the date heading close to the collapse chevron", () => {
    const css = readFileSync(
      "src/styles/components/planner-day-blocks.css",
      "utf8",
    );

    expect(css).toContain("gap: 0;");
    expect(css).toContain("padding: 4px 9px 4px 4px;");
  });

  it("uses borderless rounded-square cells for planner collapse icons", () => {
    const sectionToggleRule = cssRule(
      readFileSync("src/styles/components/left-panel.css", "utf8"),
      ".section-toggle-button",
    );
    const dayCollapseRule = cssRule(
      readFileSync("src/styles/components/planner-day-blocks.css", "utf8"),
      ".day-collapse-button",
    );

    for (const rule of [sectionToggleRule, dayCollapseRule]) {
      expect(rule).toContain("background: transparent;");
      expect(rule).toContain("border: 0;");
      expect(rule).toContain("border-radius: 6px;");
      expect(rule).toContain("flex: 0 0 28px;");
      expect(rule).toContain("height: 28px;");
      expect(rule).toContain("width: 28px;");
    }
  });
});

function dayCollapseButtonMarkup(collapsedDates: ReadonlySet<string>) {
  return markupBetween(
    itinerarySectionMarkup(collapsedDates),
    "day-collapse-button",
    "button",
  );
}

function itinerarySectionMarkup(collapsedDates: ReadonlySet<string>) {
  return renderToStaticMarkup(
    createElement(ItinerarySection, {
      itinerary: itinerary(),
      activePlaceId: null,
      activeCanonicalPlaceId: null,
      activeSegmentId: null,
      activeDate: null,
      collapsedDates,
      routeGeometries: new Map(),
      markerLabels: new Map(),
      canEdit: true,
      canAddVisits: true,
      deletingPlaceIds: new Set<number>(),
      deletingItineraryItemIds: new Set<number>(),
      isExpanded: false,
      isOpen: true,
      isUnscheduledOpen: true,
      showRouteSegments: true,
      dropTargetKey: null,
      exportFeedback: null,
      onDropTargetChange: vi.fn(),
      onToggleOpen: vi.fn(),
      onToggleUnscheduledOpen: vi.fn(),
      onToggleRouteSegments: vi.fn(),
      onCopyExport: vi.fn(),
      onDownloadExport: vi.fn(),
      onToggleDatePlacePicker: vi.fn(),
      onSelectPlace: vi.fn(),
      onSelectCanonicalPlace: vi.fn(),
      onSelectSegment: vi.fn(),
      onToggleDateCollapsed: vi.fn(),
      onSelectDate: vi.fn(),
      onAddVisit: vi.fn(),
      onEdit: vi.fn(),
      onEditItem: vi.fn(),
      onDelete: vi.fn(),
      onDeleteItem: vi.fn(),
      onScheduleItem: vi.fn(),
      onModeChange: vi.fn(),
      onConfirmDeletion: vi.fn(),
    }),
  );
}

function markupBetween(markup: string, className: string, tag: string) {
  const start = markup.indexOf(`class="${className}`);
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

function itinerary(): ItineraryView {
  return {
    days: [
      {
        date: "2026-06-01",
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
