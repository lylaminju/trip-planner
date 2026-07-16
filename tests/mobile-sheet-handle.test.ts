import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TripPlannerApp } from "@/components/TripPlannerApp";
import { buildTripPlannerInitialData } from "./helpers/fixtures";

describe("mobile sheet handle", () => {
  it("renders the resize handle in a dedicated rail before scrollable content", () => {
    const markup = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        initialData: buildTripPlannerInitialData(),
      }),
    );

    const railIndex = markup.indexOf('class="mobile-sheet-handle-rail"');
    const handleIndex = markup.indexOf('class="mobile-sheet-handle"');
    const contentIndex = markup.indexOf('class="mobile-sheet-content"');

    expect(railIndex).toBeGreaterThanOrEqual(0);
    expect(handleIndex).toBeGreaterThan(railIndex);
    expect(contentIndex).toBeGreaterThan(handleIndex);
  });

  it("reserves a 40px mobile rail and keeps planner content scrollable below it", () => {
    const css = readFileSync("src/styles/mobile.css", "utf8");
    const layoutCss = readFileSync("src/styles/layout.css", "utf8");

    expect(cssRule(css, ".mobile-sheet-handle-rail")).toContain(
      "height: 40px;",
    );
    expect(cssRule(css, ".planner-panel.mobile-sheet-collapsed")).toContain(
      "height: calc(40px + env(safe-area-inset-bottom));",
    );
    expect(cssRule(css, ".planner-panel")).toContain("overflow: hidden;");
    expect(topLevelCssRule(layoutCss, ".planner-scroll")).toContain(
      "overflow-y: auto;",
    );
  });
});

function cssRule(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n  }", start);
  expect(end).toBeGreaterThanOrEqual(0);

  return css.slice(start, end + 4);
}

function topLevelCssRule(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n}", start);
  expect(end).toBeGreaterThanOrEqual(0);

  return css.slice(start, end + 2);
}
