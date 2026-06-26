import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  ItineraryItemRow,
  PlaceListRow,
} from "@/components/planner-panel/PlaceRows";
import { VisitTimeInlineEditor } from "@/components/planner-panel/VisitTimeInlineEditor";
import { buildItineraryItem, buildPlace } from "./helpers/fixtures";

describe("PlaceRows", () => {
  it("disables a place delete button and replaces the trash icon while deleting", () => {
    const markup = renderToStaticMarkup(
      createElement(PlaceListRow, {
        place: buildPlace({ id: 7, name: "Bryant Park" }),
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
  });

  it("disables an itinerary item delete button and replaces the trash icon while deleting", () => {
    const markup = renderToStaticMarkup(
      createElement(ItineraryItemRow, {
        item: buildItineraryItem({
          id: 11,
          place: buildPlace({ id: 7, name: "Bryant Park" }),
        }),
        active: false,
        markerLabel: null,
        markerColor: "#0f766e",
        canEdit: true,
        isDeleting: true,
        onSelect: vi.fn(),
        onEdit: vi.fn(),
        onTimeChange: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(markup).toContain('aria-label="Deleting visit to Bryant Park"');
    expect(markup).toContain("disabled");
    expect(markup).toContain("delete-loading-spinner");
  });

  it("disables add visit when trip dates are not confirmed", () => {
    const markup = renderToStaticMarkup(
      createElement(PlaceListRow, {
        place: buildPlace({ id: 7, name: "Bryant Park" }),
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

  it("groups itinerary edit and delete actions for desktop hover reveal", () => {
    const markup = renderToStaticMarkup(
      createElement(ItineraryItemRow, {
        item: buildItineraryItem({
          id: 11,
          place: buildPlace({ id: 7, name: "Bryant Park" }),
        }),
        active: false,
        markerLabel: null,
        markerColor: "#0f766e",
        canEdit: true,
        isDeleting: false,
        onSelect: vi.fn(),
        onEdit: vi.fn(),
        onTimeChange: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(markup).toContain('class="place-row visit-row');
    expect(markup).toContain('class="visit-row-actions"');
    expect(markup).toContain('aria-label="Edit visit to Bryant Park"');
    expect(markup).toContain('aria-label="Delete visit to Bryant Park"');
  });

  it("renders itinerary visit times as split quick-edit segments", () => {
    const markup = renderToStaticMarkup(
      createElement(ItineraryItemRow, {
        item: buildItineraryItem({
          id: 11,
          visit_time: "10:30",
          place: buildPlace({ id: 7, name: "Bryant Park" }),
        }),
        active: false,
        markerLabel: "2",
        markerColor: "#0f766e",
        canEdit: true,
        isDeleting: false,
        onSelect: vi.fn(),
        onEdit: vi.fn(),
        onTimeChange: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(markup).toContain('class="visit-time-slot"');
    expect(markup).toContain('class="visit-time-segments"');
    expect(markup).toContain('data-time-segment="hour"');
    expect(markup).toContain('aria-label="Edit visit hour for Bryant Park"');
    expect(markup).toContain(">10</button>");
    expect(markup).toContain('class="visit-time-separator"');
    expect(markup).toContain('data-time-segment="minute"');
    expect(markup).toContain('aria-label="Edit visit minute for Bryant Park"');
    expect(markup).toContain(">30</button>");
  });

  it("offers add time from untimed editable visit rows", () => {
    const item = buildItineraryItem({
      id: 11,
      place: buildPlace({ id: 7, name: "Bryant Park" }),
    });
    const markup = renderToStaticMarkup(
      createElement(ItineraryItemRow, {
        item: { ...item, visit_time: null },
        active: false,
        markerLabel: null,
        markerColor: "#0f766e",
        canEdit: true,
        isDeleting: false,
        onSelect: vi.fn(),
        onEdit: vi.fn(),
        onTimeChange: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(markup).toContain('class="visit-time-chip empty"');
    expect(markup).toContain('aria-label="Add visit time for Bryant Park"');
    expect(markup).toContain("Add time");
  });

  it("renders the inline time editor with an immediate hour menu", () => {
    const markup = renderToStaticMarkup(
      createElement(VisitTimeInlineEditor, {
        placeName: "Bryant Park",
        value: "19:00",
        activeSegment: "hour",
        isSaving: false,
        error: null,
        onValueChange: vi.fn(),
        onActiveSegmentChange: vi.fn(),
        onSave: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    expect(markup).toContain('class="visit-time-inline-editor"');
    expect(markup).toContain('aria-label="Visit time for Bryant Park"');
    expect(markup).toContain('class="visit-time-segment active"');
    expect(markup).toContain('data-time-segment="hour"');
    expect(markup).toContain('data-time-segment="minute"');
    expect(markup).toContain('class="visit-time-menu hour-menu"');
    expect(markup).toContain('role="listbox"');
    expect(markup).toContain('aria-label="Choose hour for Bryant Park"');
    expect(markup).toContain('class="visit-time-menu-option selected"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain(">19</button>");
    expect(markup).toContain(">23</button>");
    expect(markup).not.toContain("<select");
    expect(markup).not.toContain('type="text"');
    expect(markup).not.toContain('type="time"');
    expect(markup).not.toContain("-15");
    expect(markup).not.toContain("+15");
    expect(markup).not.toContain("Clear");
    expect(markup).not.toContain("Save");
  });

  it("renders the inline time editor with an immediate minute menu", () => {
    const markup = renderToStaticMarkup(
      createElement(VisitTimeInlineEditor, {
        placeName: "Bryant Park",
        value: "19:30",
        activeSegment: "minute",
        isSaving: false,
        error: null,
        onValueChange: vi.fn(),
        onActiveSegmentChange: vi.fn(),
        onSave: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    expect(markup).toContain('class="visit-time-menu minute-menu"');
    expect(markup).toContain('aria-label="Choose minute for Bryant Park"');
    expect(markup).toContain('data-time-segment="minute"');
    expect(markup).toContain(">30</button>");
    expect(markup).toContain(">50</button>");
  });

  it("keeps unscheduled place row actions outside the visit hover reveal", () => {
    const markup = renderToStaticMarkup(
      createElement(PlaceListRow, {
        place: buildPlace({ id: 7, name: "Bryant Park" }),
        active: false,
        canEdit: true,
        canAddVisit: true,
        isDeleting: false,
        onSelect: vi.fn(),
        onEdit: vi.fn(),
        onAddVisit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(markup).not.toContain("visit-row-actions");
  });

  it("reveals visit row actions only on hover-capable desktop layouts", () => {
    const css = readFileSync(
      "src/styles/components/planner-place-rows.css",
      "utf8",
    );

    expect(css).toContain(
      "@media (min-width: 901px) and (hover: hover) and (pointer: fine)",
    );
    expect(css).toContain(".visit-row-actions {\n    opacity: 0;");
    expect(css).toContain("pointer-events: none;");
    expect(css).toContain(".visit-row:hover .visit-row-actions");
    expect(css).toContain(".visit-row:focus-within .visit-row-actions");
    expect(css).toContain(".visit-row.active .visit-row-actions");
    expect(css).toContain("opacity: 1;");
    expect(css).toContain("pointer-events: auto;");
  });

  it("keeps the text editor inline while using a small hour and minute menu", () => {
    const css = readFileSync(
      "src/styles/components/planner-place-rows.css",
      "utf8",
    );

    expect(css).toContain(".visit-time-inline-editor");
    expect(css).toContain(".visit-row:focus-within .visit-row-actions");
    expect(css).toContain(".visit-time-segment");
    expect(css).toContain(".visit-time-menu");
    expect(css).not.toContain(".visit-time-quick-editor");
  });

  it("keeps the time chip and inline editor in a stable plain text slot", () => {
    const css = readFileSync(
      "src/styles/components/planner-place-rows.css",
      "utf8",
    );
    const visitRowRule = cssRule(css, ".visit-row");
    const slotRule = cssRule(css, ".visit-time-slot");
    const titleLineRule = cssRule(css, ".visit-row-title-line");
    const markerRule = cssRule(css, ".visit-row-content .place-marker-label");
    const visitPlaceMainRule = cssRule(css, ".place-main.visit-place-main");
    const visitPlaceTitleRule = cssRule(
      css,
      ".place-main.visit-place-main .place-title",
    );
    const timeTextRule = cssRule(
      css,
      ".visit-time-chip,\n.visit-time-text,\n.visit-time-segment,\n.visit-time-separator",
    );
    const chipRule = cssRule(css, ".visit-time-chip");
    const chipHoverRule = cssRule(css, ".visit-time-chip:hover");
    const segmentRule = cssRule(css, ".visit-time-segment");
    const segmentHoverRule = cssRule(css, ".visit-time-segment:hover");
    const menuRule = cssRule(css, ".visit-time-menu");
    const hourMenuRule = cssRule(css, ".visit-time-menu.hour-menu");
    const hourMenuScrollbarRule = cssRule(
      css,
      ".visit-time-menu.hour-menu::-webkit-scrollbar",
    );

    expect(slotRule).toContain("--visit-time-slot-width: 70px;");
    expect(slotRule).toContain("flex: 0 0 var(--visit-time-slot-width);");
    expect(slotRule).toContain("width: var(--visit-time-slot-width);");
    expect(visitRowRule).toContain("align-items: center;");
    expect(titleLineRule).toContain("align-items: center;");
    expect(titleLineRule).toContain("gap: 4px;");
    expect(markerRule).toContain("margin-top: 0;");
    expect(visitPlaceMainRule).toContain("padding: 0 4px 0 0;");
    expect(visitPlaceTitleRule).toContain("min-height: 24px;");
    expect(timeTextRule).toContain("font-size: 14px;");
    expect(segmentRule).toContain("box-sizing: border-box;");
    expect(segmentRule).toContain("border-width: 0;");
    expect(segmentRule).toContain("border-radius: 0;");
    expect(chipRule).toContain("background: transparent;");
    expect(chipRule).toContain("border-width: 0;");
    expect(chipHoverRule).toContain("background: transparent;");
    expect(segmentHoverRule).toContain("background: transparent;");
    expect(chipRule).not.toContain("border-radius");
    expect(menuRule).toContain("position: absolute;");
    expect(menuRule).toContain("top: calc(100% + 6px);");
    expect(menuRule).toContain("overflow-y: auto;");
    expect(hourMenuRule).toContain("scrollbar-width: none;");
    expect(hourMenuRule).toContain("-ms-overflow-style: none;");
    expect(hourMenuScrollbarRule).toContain("display: none;");
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
