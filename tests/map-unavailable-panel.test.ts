import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { MapPanel } from "@/components/MapPanel";
import type { ItineraryView } from "@/lib/types";

import { buildItineraryItem, buildPlace } from "./helpers/fixtures";
import { buildMapPanelProps } from "./helpers/map-panel-props";

describe("MapPanel without a usable map", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  });

  it("lists every place once as a Google Maps link, in itinerary order", () => {
    const markup = renderToStaticMarkup(
      createElement(MapPanel, buildMapPanelProps(itineraryFixture())),
    );

    expect(markup).toContain('aria-label="Map unavailable"');
    expect(markup).toContain('href="https://maps.example/place-1"');
    expect(markup).toContain('href="https://maps.example/place-9"');
    expect(markup).toContain('href="https://maps.example/place-2"');
    expect(markup).toContain('href="https://maps.example/place-3"');

    expect(markup.indexOf("Louvre")).toBeLessThan(
      markup.indexOf("Grand Lodging"),
    );
    expect(markup.indexOf("Grand Lodging")).toBeLessThan(
      markup.indexOf("Orsay"),
    );
    expect(markup.indexOf("Orsay")).toBeLessThan(markup.indexOf("Backlog"));

    // Lodging is scheduled on both days; a flat list has no day context to
    // tell two visits apart, so the place is listed once.
    expect(countOccurrences(markup, "Grand Lodging")).toBe(1);

    // The planner panel sits beside this one and owns day grouping. Repeating
    // it here would duplicate that structure on screen.
    expect(markup).not.toContain("Day 1");
  });
});

function itineraryFixture(): ItineraryView {
  const lodging = buildPlace({
    id: 9,
    name: "Grand Lodging",
    google_maps_url: "https://maps.example/place-9",
  });

  return {
    days: [
      {
        date: "2026-06-01",
        // Unused by this panel; the map overlays own day colors.
        color: "transparent",
        items: [
          buildItineraryItem({
            id: 1,
            visit_date: "2026-06-01",
            place: buildPlace({
              id: 1,
              name: "Louvre",
              google_maps_url: "https://maps.example/place-1",
            }),
          }),
          buildItineraryItem({
            id: 2,
            visit_date: "2026-06-01",
            place: lodging,
          }),
        ],
        segments: [],
      },
      {
        date: "2026-06-02",
        color: "transparent",
        items: [
          buildItineraryItem({
            id: 3,
            visit_date: "2026-06-02",
            place: buildPlace({
              id: 2,
              name: "Orsay",
              google_maps_url: "https://maps.example/place-2",
            }),
          }),
          buildItineraryItem({
            id: 4,
            visit_date: "2026-06-02",
            place: lodging,
          }),
        ],
        segments: [],
      },
    ],
    unscheduled: [
      buildPlace({
        id: 3,
        name: "Backlog Place",
        google_maps_url: "https://maps.example/place-3",
      }),
    ],
  };
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}
