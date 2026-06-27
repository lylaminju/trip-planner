import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SegmentRow } from "@/components/SegmentRow";
import { buildPlace, buildRouteSegment } from "./helpers/fixtures";

describe("SegmentRow", () => {
  it("renders the selected travel mode as an icon-only trigger", () => {
    const markup = renderToStaticMarkup(
      createElement(SegmentRow, {
        segment: buildRouteSegment({ mode: "walking" }),
        from: buildPlace({ name: "Cafe" }),
        to: buildPlace({ id: 2, name: "Museum" }),
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
    expect(markup).toContain("18 min");
    expect(markup).toContain("api=1");
    expect(markup).toContain("travelmode=walking");
  });

  it("disables the mode trigger for read-only planners without hiding duration", () => {
    const markup = renderToStaticMarkup(
      createElement(SegmentRow, {
        segment: buildRouteSegment({ mode: "transit" }),
        from: buildPlace({ name: "Cafe" }),
        to: buildPlace({ id: 2, name: "Museum" }),
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

  it("reserves the duration column when duration data is not available", () => {
    const markup = renderToStaticMarkup(
      createElement(SegmentRow, {
        segment: buildRouteSegment({ mode: "driving" }),
        from: buildPlace({ name: "Cafe" }),
        to: buildPlace({ id: 2, name: "Museum" }),
        active: false,
        canEdit: true,
        onSelect: vi.fn(),
        onModeChange: vi.fn(),
      }),
    );

    expect(markup).toContain('class="route-duration placeholder"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("9 hr 59 min");
    expect(markup).toContain("travelmode=driving");
  });

  it("reveals the Google Maps action on desktop route segment hover", () => {
    const markup = renderToStaticMarkup(
      createElement(SegmentRow, {
        segment: buildRouteSegment({ mode: "walking" }),
        from: buildPlace({ name: "Cafe" }),
        to: buildPlace({ id: 2, name: "Museum" }),
        active: false,
        durationSeconds: 18 * 60,
        canEdit: true,
        onSelect: vi.fn(),
        onModeChange: vi.fn(),
      }),
    );
    const css = readFileSync(
      "src/styles/components/planner-route-segments.css",
      "utf8",
    );

    expect(markup).toContain('class="route-segment-actions"');
    expect(markup).toContain(
      'class="small-button route-segment-map-link" href=',
    );
    expect(markup).toContain(
      'class="route-segment-map-label">Open in Google Maps</span>',
    );
    expect(css).toContain(
      "@media (min-width: 901px) and (hover: hover) and (pointer: fine)",
    );
    expect(css).toContain(".route-segment-map-label {\n  display: none;");
    expect(css).toContain(".route-segment-actions {\n    opacity: 0;");
    expect(css).toContain(".route-segment-map-label {\n    display: inline;");
    expect(css).toContain(".route-segment-map-link svg {\n    display: none;");
    expect(css).toContain(".segment-row:hover .route-segment-actions");
    expect(css).toContain(".segment-row:focus-within .route-segment-actions");
    expect(css).toContain(".segment-row.active .route-segment-actions");
    expect(css).toContain("pointer-events: auto;");
  });
});
