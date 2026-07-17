import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PlannerPanel } from "@/components/PlannerPanel";
import type { ItineraryView } from "@/lib/types";
import { buildPlace } from "./helpers/fixtures";

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
    expect(buttonMarkup).toContain(
      'aria-label="Collapse planner and show map"',
    );
    expect(buttonMarkup).toContain("panel-expand-toggle-icon");
    expect(buttonMarkup).toContain("<svg");
    expect(
      buttonMarkup.indexOf('<span class="panel-expand-toggle-icon"'),
    ).toBeLessThan(buttonMarkup.indexOf("<span>Collapse</span>"));
  });

  it("shows the AI planning action when one is available", () => {
    const markup = renderToStaticMarkup(
      createElement(
        PlannerPanel,
        plannerPanelProps({ isExpanded: false, onPlanWithAi: vi.fn() }),
      ),
    );
    const buttonMarkup = markupBetween(markup, "ai-plan-button", "button");

    expect(buttonMarkup).toContain("Plan with AI");
    expect(buttonMarkup).toContain("magic-wand-svg");
  });

  it("hides the AI planning action when one is not available", () => {
    const markup = renderToStaticMarkup(
      createElement(PlannerPanel, plannerPanelProps({ isExpanded: false })),
    );

    expect(markup).not.toContain("Plan with AI");
    expect(markup).not.toContain('class="ai-plan-button"');
  });
});

function plannerPanelProps(overrides: {
  isExpanded: boolean;
  onPlanWithAi?: () => void;
}) {
  return {
    title: "Tokyo Spring",
    tripPeriodLabel: "Apr 1 - 7, 2026",
    members: [],
    currentUserId: "user-1",
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
    onPlanWithAi: overrides.onPlanWithAi,
    onMobileSheetStateChange: vi.fn(),
    onAdd: vi.fn(),
    onEditTrip: vi.fn(),
    onCopyExport: vi.fn(),
    onDownloadExport: vi.fn(),
    onAddVisit: vi.fn(),
    onEdit: vi.fn(),
    onEditItem: vi.fn(),
    onDelete: vi.fn(),
    onDeleteAllPlaces: vi.fn(),
    onSelectPlace: vi.fn(),
    onSelectCanonicalPlace: vi.fn(),
    onSelectSegment: vi.fn(),
    onToggleDateCollapsed: vi.fn(),
    onSelectDate: vi.fn(),
    onClearSelection: vi.fn(),
    onSchedulePlace: vi.fn(),
    onScheduleItem: vi.fn(),
    onModeChange: vi.fn(),
    onDeleteItem: vi.fn(),
    onDeleteAllItems: vi.fn(),
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
    unscheduled: [buildPlace()],
  };
}
