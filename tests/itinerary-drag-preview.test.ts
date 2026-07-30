import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DragFloater } from "@/components/planner-panel/DragFloater";
import type { ItineraryView } from "@/lib/types";
import {
  buildItineraryItem,
  buildPlace,
  buildRouteSegment,
} from "./helpers/fixtures";
import { renderItinerarySection } from "./helpers/itinerary-section-markup";

const DAY = "2026-06-01";
const DRAG_ROW_HEIGHT = 64;

describe("itinerary drag preview", () => {
  it("opens the landing gap at the hovered slot", () => {
    const itinerary = threeStopItinerary();
    const markup = renderItinerarySection({
      itinerary,
      draggingItem: itinerary.days[0].items[2],
      dragPreview: {
        kind: "day-slot",
        date: DAY,
        index: 1,
        visitTime: "09:30",
        isOwnSlot: false,
      },
    });

    expect(markup.indexOf("itinerary-slot-gap")).toBeGreaterThan(
      markup.indexOf("Cafe"),
    );
    expect(markup.indexOf("itinerary-slot-gap")).toBeLessThan(
      markup.indexOf("Museum"),
    );
  });

  it("opens the landing gap after the last row for an end-of-day slot", () => {
    const itinerary = threeStopItinerary();
    const markup = renderItinerarySection({
      itinerary,
      draggingItem: itinerary.days[0].items[2],
      dragPreview: {
        kind: "day-slot",
        date: DAY,
        index: 2,
        visitTime: "11:00",
        isOwnSlot: false,
      },
    });

    expect(markup.indexOf("itinerary-slot-gap")).toBeGreaterThan(
      markup.indexOf("Museum"),
    );
  });

  it("sizes the landing gap to the row that was lifted out", () => {
    const itinerary = threeStopItinerary();
    const markup = renderItinerarySection({
      itinerary,
      draggingItem: itinerary.days[0].items[2],
      dragPreview: {
        kind: "day-slot",
        date: DAY,
        index: 0,
        visitTime: "08:00",
        isOwnSlot: false,
      },
    });

    expect(markup).toContain(`height:${DRAG_ROW_HEIGHT}px`);
  });

  it("keeps the gap in the row's own slot when no target is hovered", () => {
    const itinerary = threeStopItinerary();
    const markup = renderItinerarySection({
      itinerary,
      draggingItem: itinerary.days[0].items[0],
    });

    expect(markup.indexOf("itinerary-slot-gap")).toBeLessThan(
      markup.indexOf("Museum"),
    );
  });

  it("lifts the source row's stack out of the list while dragging", () => {
    const itinerary = threeStopItinerary();
    const markup = renderItinerarySection({
      itinerary,
      draggingItem: itinerary.days[0].items[0],
    });

    expect(markup).toContain("itinerary-item-stack drag-source");
  });

  it("previews route leg stand-ins and marks legs the drop invalidates", () => {
    const itinerary = threeStopItinerary();
    const markup = renderItinerarySection({
      itinerary,
      draggingItem: itinerary.days[0].items[2],
      dragPreview: {
        kind: "day-slot",
        date: DAY,
        index: 1,
        visitTime: "09:30",
        isOwnSlot: false,
      },
    });

    expect(
      markup.match(/class="itinerary-slot-segment-placeholder"/g),
    ).toHaveLength(2);
    // Legs into the lifted row and across the previewed gap are stale: the
    // gap's own stand-in legs replace them.
    expect(markup.match(/class="segment-row stale"/g)).toHaveLength(2);
  });

  it("previews the leg that closes over the lifted row's slot", () => {
    const itinerary = threeStopItinerary();
    const markup = renderItinerarySection({
      itinerary,
      // Museum sits between Cafe and Zoo, so moving it away leaves those two
      // adjacent and the drop connects them with a new leg.
      draggingItem: itinerary.days[0].items[1],
      dragPreview: {
        kind: "day-slot",
        date: DAY,
        index: 2,
        visitTime: "12:00",
        isOwnSlot: false,
      },
    });

    expect(
      markup.match(/class="itinerary-slot-segment-placeholder"/g),
    ).toHaveLength(2);
    expect(markup.indexOf("itinerary-slot-segment-placeholder")).toBeLessThan(
      markup.indexOf("Zoo"),
    );
    expect(markup.indexOf("itinerary-slot-gap")).toBeGreaterThan(
      markup.indexOf("Zoo"),
    );
  });

  it("omits the closing leg while the row previews in its own slot", () => {
    const itinerary = threeStopItinerary();
    const markup = renderItinerarySection({
      itinerary,
      draggingItem: itinerary.days[0].items[1],
      dragPreview: {
        kind: "day-slot",
        date: DAY,
        index: 1,
        visitTime: "10:00",
        isOwnSlot: true,
      },
    });

    // Only the gap's own two stand-ins: the row is previewing back into the
    // hole it left, so nothing closes over it.
    expect(
      markup.match(/class="itinerary-slot-segment-placeholder"/g),
    ).toHaveLength(2);
  });

  it("previews no route legs for an untimed drop", () => {
    const itinerary = threeStopItinerary();
    const markup = renderItinerarySection({
      itinerary,
      draggingItem: itinerary.days[0].items[2],
      dragPreview: {
        kind: "day-slot",
        date: DAY,
        index: 2,
        visitTime: null,
        isOwnSlot: false,
      },
    });

    expect(
      markup.match(/class="itinerary-slot-segment-placeholder"/g),
    ).toBeNull();
  });

  it("takes stale legs out of the flow so their slot leaves no gap", () => {
    const css = readFileSync(
      "src/styles/components/planner-route-segments.css",
      "utf8",
    );
    const staleRule = css.slice(
      css.indexOf(".segment-row.stale {"),
      css.indexOf("\n}", css.indexOf(".segment-row.stale {")),
    );

    expect(staleRule).toContain("display: none");
  });

  it("highlights a collapsed day as a whole-day drop target", () => {
    const markup = renderItinerarySection({
      collapsedDates: new Set([DAY]),
      dragPreview: { kind: "day", date: DAY },
    });

    expect(markup).toContain("drop-target");
  });

  it("highlights the unscheduled block when previewing an unschedule drop", () => {
    const markup = renderItinerarySection({
      dragPreview: { kind: "unscheduled" },
    });

    expect(markup).toContain("unscheduled-block drop-target");
  });
});

describe("dragged row floater", () => {
  it("shows the visit time the drop would assign", () => {
    const markup = renderToStaticMarkup(
      createElement(DragFloater, {
        item: cafeItem(),
        preview: {
          kind: "day-slot",
          date: DAY,
          index: 1,
          visitTime: "09:30",
          isOwnSlot: false,
        },
        markerColor: "var(--accent)",
        geometry: { left: 10, top: 20, width: 320, height: DRAG_ROW_HEIGHT },
        floaterRef: { current: null },
      }),
    );

    expect(markup).toContain("itinerary-drag-floater");
    expect(markup).toContain("Cafe");
    expect(markup).toContain("09:30");
  });

  it("drops the visit time when hovering the unscheduled list", () => {
    const markup = renderToStaticMarkup(
      createElement(DragFloater, {
        item: cafeItem(),
        preview: { kind: "unscheduled" },
        markerColor: "var(--accent)",
        geometry: { left: 10, top: 20, width: 320, height: DRAG_ROW_HEIGHT },
        floaterRef: { current: null },
      }),
    );

    // Unscheduling clears the time, so the floating row must not keep
    // advertising a time the drop would discard.
    expect(markup).not.toContain("09:00");
  });
});

function cafeItem() {
  const cafe = buildPlace({ id: 1, name: "Cafe" });

  return buildItineraryItem({
    id: 10,
    place_id: cafe.id,
    place: cafe,
    visit_date: DAY,
    visit_time: "09:00",
  });
}

function threeStopItinerary(): ItineraryView {
  const museum = buildPlace({ id: 2, name: "Museum" });
  const zoo = buildPlace({ id: 3, name: "Zoo" });
  const items = [
    cafeItem(),
    buildItineraryItem({
      id: 11,
      place_id: museum.id,
      place: museum,
      visit_date: DAY,
      visit_time: "10:00",
    }),
    buildItineraryItem({
      id: 12,
      place_id: zoo.id,
      place: zoo,
      visit_date: DAY,
      visit_time: "11:00",
    }),
  ];

  return {
    days: [
      {
        date: DAY,
        color: "var(--accent)",
        items,
        segments: [
          {
            fromItemId: 10,
            toItemId: 11,
            segment: buildRouteSegment({
              id: 98,
              from_item_id: 10,
              to_item_id: 11,
              mode: "walking",
            }),
          },
          {
            fromItemId: 11,
            toItemId: 12,
            segment: buildRouteSegment({
              id: 99,
              from_item_id: 11,
              to_item_id: 12,
              mode: "walking",
            }),
          },
        ],
      },
    ],
    unscheduled: [],
  };
}
