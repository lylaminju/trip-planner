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
});
