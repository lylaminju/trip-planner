import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SectionToggle } from "@/components/planner-panel/SectionToggle";
import type { ItineraryView } from "@/lib/types";
import {
  buildItineraryItem,
  buildPlace,
  buildRouteSegment,
} from "./helpers/fixtures";
import { renderItinerarySection } from "./helpers/itinerary-section-markup";

describe("planner collapse controls", () => {
  it("renders section toggles with an svg chevron instead of text glyphs", () => {
    const markup = renderToStaticMarkup(
      createElement(SectionToggle, {
        title: "Unscheduled",
        open: true,
        onToggle: vi.fn(),
      }),
    );
    const iconMarkup = markupBetween(markup, "section-toggle-icon", "span");

    expect(iconMarkup).toContain("<svg");
  });

  it("keeps section titles outside the collapse button", () => {
    const markup = renderToStaticMarkup(
      createElement(SectionToggle, {
        title: "Unscheduled",
        open: true,
        onToggle: vi.fn(),
      }),
    );
    const buttonMarkup = markupBetween(
      markup,
      "section-toggle-button",
      "button",
    );

    expect(buttonMarkup).toContain('aria-label="Collapse Unscheduled"');
    expect(buttonMarkup).not.toContain("<h2>");
    expect(markup).toContain("</button><h2>Unscheduled</h2>");
  });

  it("renders itinerary day collapse buttons with svg chevrons in both states", () => {
    const openMarkup = dayCollapseButtonMarkup(new Set());
    const collapsedMarkup = dayCollapseButtonMarkup(new Set(["2026-06-01"]));

    expect(openMarkup).toContain('aria-expanded="true"');
    expect(openMarkup).toContain("<svg");

    expect(collapsedMarkup).toContain('aria-expanded="false"');
    expect(collapsedMarkup).toContain("<svg");
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

    expect(dayPrefixMarkup).toContain('style="color:var(--accent)"');
  });

  it("renders route segment rows for matching itinerary items", () => {
    const markup = itinerarySectionMarkup(new Set(), {
      itinerary: itineraryWithSegment(),
      routeGeometries: new Map([
        [99, { segment_id: 99, status: "ok", duration_seconds: 10 * 60 }],
      ]),
    });

    expect(markup).toContain('class="segment-row');
    expect(markup).toContain("10 min");
    expect(markup).toContain("travelmode=walking");
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
      readFileSync("src/styles/components/planner-panel.css", "utf8"),
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

function itinerarySectionMarkup(
  collapsedDates: ReadonlySet<string>,
  overrides: Partial<Parameters<typeof renderItinerarySection>[0]> = {},
) {
  return renderItinerarySection({ collapsedDates, ...overrides });
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

function itineraryWithSegment(): ItineraryView {
  const cafe = buildPlace({ id: 1, name: "Cafe" });
  const museum = buildPlace({ id: 2, name: "Museum" });
  const firstItem = buildItineraryItem({
    id: 10,
    place_id: cafe.id,
    place: cafe,
    visit_time: "09:00",
  });
  const secondItem = buildItineraryItem({
    id: 11,
    place_id: museum.id,
    place: museum,
    visit_time: "10:00",
  });
  const segment = buildRouteSegment({
    id: 99,
    from_item_id: firstItem.id,
    to_item_id: secondItem.id,
    mode: "walking",
  });

  return {
    days: [
      {
        date: "2026-06-01",
        color: "var(--accent)",
        items: [firstItem, secondItem],
        segments: [
          {
            fromItemId: firstItem.id,
            toItemId: secondItem.id,
            segment,
          },
        ],
      },
    ],
    unscheduled: [],
  };
}
