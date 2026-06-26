import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  ItineraryItemRow,
  PlaceListRow,
} from "@/components/planner-panel/PlaceRows";
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
        onDelete: vi.fn(),
      }),
    );

    expect(markup).toContain('class="place-row visit-row');
    expect(markup).toContain('class="visit-row-actions"');
    expect(markup).toContain('aria-label="Edit visit to Bryant Park"');
    expect(markup).toContain('aria-label="Delete visit to Bryant Park"');
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
