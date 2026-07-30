import { describe, expect, it } from "vitest";

import {
  dragPreviewsEqual,
  inferEndVisitTime,
  inferInsertedVisitTime,
  inferStartVisitTime,
  inferVisitTimeForInsertionIndex,
  insertionIndexFromPointer,
  resolveDayDropSchedule,
  resolveDaySlotInsertion,
} from "@/components/planner-panel/drag-schedule";
import type { ItineraryItem, Place } from "@/lib/types";

const stamp = "2026-05-20 00:00:00";

describe("drag schedule helpers", () => {
  it("inserts a midpoint time between two timed visits", () => {
    const result = inferInsertedVisitTime(
      itineraryItem({ id: 1, visit_time: "09:00" }),
      itineraryItem({ id: 2, visit_time: "10:00" }),
    );

    expect(result).toBe("09:30");
  });

  it("skips malformed visit times when inferring the end visit time", () => {
    const result = inferEndVisitTime([
      itineraryItem({ id: 1, visit_time: "09:00" }),
      itineraryItem({ id: 2, visit_time: "foo" }),
      itineraryItem({ id: 3, visit_time: "10:00" }),
    ]);

    expect(result).toBe("11:00");
  });

  it("caps inferred end times at the end of the day", () => {
    const result = inferEndVisitTime([
      itineraryItem({ id: 1, visit_time: "23:30" }),
    ]);

    expect(result).toBe("23:59");
  });

  it("infers one hour before the earliest timed visit", () => {
    const result = inferStartVisitTime([
      itineraryItem({ id: 1, visit_time: "10:00" }),
      itineraryItem({ id: 2, visit_time: "12:00" }),
    ]);

    expect(result).toBe("09:00");
  });

  it("skips malformed visit times when inferring the start visit time", () => {
    const result = inferStartVisitTime([
      itineraryItem({ id: 1, visit_time: "foo" }),
      itineraryItem({ id: 2, visit_time: "10:00" }),
      itineraryItem({ id: 3, visit_time: "12:00" }),
    ]);

    expect(result).toBe("09:00");
  });

  it("clamps inferred start times at the start of the day", () => {
    const result = inferStartVisitTime([
      itineraryItem({ id: 1, visit_time: "00:30" }),
    ]);

    expect(result).toBe("00:00");
  });

  it("treats a drop onto the item's current day as a no-op", () => {
    const item = itineraryItem({
      id: 1,
      visit_date: "2026-06-01",
      visit_time: "10:00",
    });

    expect(resolveDayDropSchedule(item, "2026-06-01")).toBeNull();
  });

  it("schedules onto a different day as untimed", () => {
    const item = itineraryItem({
      id: 1,
      visit_date: "2026-06-01",
      visit_time: "10:00",
    });

    expect(resolveDayDropSchedule(item, "2026-06-02")).toEqual({
      visitDate: "2026-06-02",
      visitTime: null,
    });
  });
});

describe("insertionIndexFromPointer", () => {
  const midpoints = [120, 160, 200];

  it.each([
    [110, 0],
    [130, 1],
    [170, 2],
    [210, 3],
  ])("maps pointer y %d to insertion index %d", (pointerY, expected) => {
    expect(insertionIndexFromPointer(pointerY, midpoints)).toBe(expected);
  });

  it("maps every pointer position to the top slot when there are no rows", () => {
    expect(insertionIndexFromPointer(50, [])).toBe(0);
  });
});

describe("inferVisitTimeForInsertionIndex", () => {
  const timedItems = [
    itineraryItem({ id: 1, visit_time: "09:00" }),
    itineraryItem({ id: 2, visit_time: "10:00" }),
  ];
  const mixedItems = [
    itineraryItem({ id: 1, visit_time: "09:00" }),
    itineraryItem({ id: 2, visit_time: null }),
  ];

  it.each([
    ["an empty day stays untimed", [], 0, null],
    ["before the first timed row", timedItems, 0, "08:00"],
    ["between two timed rows", timedItems, 1, "09:30"],
    ["after the last timed row", timedItems, 2, "11:00"],
    ["at the timed-to-untimed boundary", mixedItems, 1, "10:00"],
    ["inside the untimed tail", mixedItems, 2, null],
  ])("%s", (_label, items, index, expected) => {
    expect(inferVisitTimeForInsertionIndex(items, index)).toBe(expected);
  });
});

describe("resolveDaySlotInsertion", () => {
  const timedItems = [
    itineraryItem({ id: 1, visit_time: "09:00" }),
    itineraryItem({ id: 2, visit_time: "10:00" }),
    itineraryItem({ id: 3, visit_time: "11:00" }),
    itineraryItem({ id: 4, visit_time: "12:00" }),
  ];

  it("keeps the current visit time when the gap is the item's own slot", () => {
    expect(resolveDaySlotInsertion(timedItems, timedItems[1], 1)).toEqual({
      index: 1,
      visitTime: "10:00",
      isOwnSlot: true,
    });
  });

  it("infers times from the day without the dragged item", () => {
    expect(resolveDaySlotInsertion(timedItems, timedItems[1], 2)).toEqual({
      index: 2,
      visitTime: "11:30",
      isOwnSlot: false,
    });
    expect(resolveDaySlotInsertion(timedItems, timedItems[1], 0)).toEqual({
      index: 0,
      visitTime: "08:00",
      isOwnSlot: false,
    });
  });

  it("snaps untimed drops to the name-sorted spot in the untimed tail", () => {
    const items = [
      itineraryItem({ id: 1, visit_time: "09:00" }),
      itineraryItem({ id: 2, visit_time: null }),
    ];
    const dragged = itineraryItem({ id: 9, visit_time: "10:00" });

    expect(resolveDaySlotInsertion(items, dragged, 2)).toEqual({
      index: 2,
      visitTime: null,
      isOwnSlot: false,
    });
  });

  it("snaps an untimed item dragged within its own day back to its slot", () => {
    const untimedItems = [
      itineraryItem({ id: 1, visit_time: null }),
      itineraryItem({ id: 2, visit_time: null }),
      itineraryItem({ id: 3, visit_time: null }),
    ];

    expect(resolveDaySlotInsertion(untimedItems, untimedItems[1], 2)).toEqual({
      index: 1,
      visitTime: null,
      isOwnSlot: true,
    });
  });

  it("falls back to the hovered gap when the dragged item is unknown", () => {
    expect(resolveDaySlotInsertion(timedItems.slice(0, 2), null, 1)).toEqual({
      index: 1,
      visitTime: "09:30",
      isOwnSlot: false,
    });
  });
});

describe("dragPreviewsEqual", () => {
  const slot = {
    kind: "day-slot",
    date: "2026-06-01",
    index: 1,
    visitTime: "09:30",
    isOwnSlot: false,
  } as const;

  it("treats identical previews as equal", () => {
    expect(dragPreviewsEqual(slot, { ...slot })).toBe(true);
    expect(dragPreviewsEqual({ kind: "unscheduled" }, { kind: "unscheduled" })).toBe(
      true,
    );
    expect(dragPreviewsEqual(null, null)).toBe(true);
  });

  it("distinguishes differing previews", () => {
    expect(dragPreviewsEqual(slot, { ...slot, index: 2 })).toBe(false);
    expect(dragPreviewsEqual(slot, { ...slot, isOwnSlot: true })).toBe(false);
    expect(dragPreviewsEqual(slot, { kind: "day", date: slot.date })).toBe(false);
    expect(dragPreviewsEqual(slot, null)).toBe(false);
  });
});

function itineraryItem(
  overrides: Partial<ItineraryItem> & { id: number; visit_time: string | null },
): ItineraryItem {
  const place = buildPlace(overrides.id);

  return {
    id: overrides.id,
    trip_id: overrides.trip_id ?? 1,
    place_id: overrides.place_id ?? place.id,
    place,
    visit_date: overrides.visit_date ?? "2026-06-01",
    visit_time: overrides.visit_time,
    notes: overrides.notes ?? null,
    created_at: overrides.created_at ?? stamp,
    updated_at: overrides.updated_at ?? stamp,
  };
}

function buildPlace(id: number): Place {
  return {
    id,
    trip_id: 1,
    name: `Place ${id}`,
    address: null,
    google_maps_url: "https://www.google.com/maps/place",
    google_place_id: null,
    google_place_token: null,
    google_internal_ids: null,
    source_list_url: null,
    latitude: 40,
    longitude: -74,
    notes: null,
    links: [],
    image_url: null,
    image_credit: null,
    created_at: stamp,
    updated_at: stamp,
  };
}
