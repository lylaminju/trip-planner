import { compareScheduledItems } from "@/lib/itinerary";
import type { ItineraryItem, ItineraryView } from "@/lib/types";
import {
  formatVisitTime,
  hasVisitTimeText,
  parseVisitTime,
} from "@/lib/visit-time";

// Where a dragged visit would land if released now. "day-slot" previews an
// insertion between rows of an expanded day; "day" targets a collapsed day as
// a whole; "unscheduled" clears the schedule.
export type DragPreview =
  | {
      kind: "day-slot";
      date: string;
      index: number;
      visitTime: string | null;
      isOwnSlot: boolean;
    }
  | { kind: "day"; date: string }
  | { kind: "unscheduled" };

export function dragPreviewsEqual(
  a: DragPreview | null,
  b: DragPreview | null,
): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === "day-slot" && b.kind === "day-slot") {
    return (
      a.date === b.date &&
      a.index === b.index &&
      a.visitTime === b.visitTime &&
      a.isOwnSlot === b.isOwnSlot
    );
  }
  if (a.kind === "day" && b.kind === "day") return a.date === b.date;
  return a.kind === b.kind;
}

// Resolve where a day-background drop should place the dragged item.
// Returns null (no-op) when the item is already on this day, so releasing the
// drag back onto its own day never wipes its visit time.
export function resolveDayDropSchedule(
  item: ItineraryItem,
  date: string,
): { visitDate: string; visitTime: string | null } | null {
  if (item.visit_date === date) {
    return null;
  }

  return { visitDate: date, visitTime: null };
}

export function inferInsertedVisitTime(
  previous: ItineraryItem,
  next: ItineraryItem,
): string | null {
  const previousMinutes = parseVisitTime(previous.visit_time);
  const nextMinutes = parseVisitTime(next.visit_time);
  if (
    previousMinutes === null ||
    nextMinutes === null ||
    nextMinutes - previousMinutes <= 1
  ) {
    return null;
  }

  const midpoint = (previousMinutes + nextMinutes) / 2;
  const rounded = Math.round(midpoint / 5) * 5;
  const insertedMinutes =
    rounded > previousMinutes && rounded < nextMinutes
      ? rounded
      : Math.floor(midpoint);

  if (insertedMinutes <= previousMinutes || insertedMinutes >= nextMinutes) {
    return null;
  }

  return formatVisitTime(insertedMinutes);
}

export function inferEndVisitTime(items: ItineraryItem[]): string | null {
  const timedMinutes = items
    .map((item) => parseVisitTime(item.visit_time))
    .filter((value): value is number => value !== null);
  const lastMinutes = timedMinutes.at(-1);
  if (lastMinutes === undefined) {
    return null;
  }

  return formatVisitTime(Math.min(lastMinutes + 60, 23 * 60 + 59));
}

export function inferStartVisitTime(items: ItineraryItem[]): string | null {
  const timedMinutes = items
    .map((item) => parseVisitTime(item.visit_time))
    .filter((value): value is number => value !== null);
  const firstMinutes = timedMinutes[0];
  if (firstMinutes === undefined) {
    return null;
  }

  return formatVisitTime(Math.max(firstMinutes - 60, 0));
}

// The insertion index for a pointer is the number of row midpoints above it,
// so every vertical position inside a day maps to exactly one slot.
export function insertionIndexFromPointer(
  pointerY: number,
  rowMidpoints: readonly number[],
): number {
  let index = 0;
  for (const midpoint of rowMidpoints) {
    if (pointerY > midpoint) index += 1;
  }
  return index;
}

// Visit time for a drop at `index` within a day's ordered items: before the
// first timed row -> an hour earlier; between two timed rows -> their
// midpoint; right after the last timed row -> an hour later; anywhere in the
// untimed tail or an empty day -> untimed.
export function inferVisitTimeForInsertionIndex(
  items: ItineraryItem[],
  index: number,
): string | null {
  const previous = items[index - 1] ?? null;
  const next = items[index] ?? null;

  if (previous === null) {
    return hasVisitTime(next) ? inferStartVisitTime(items) : null;
  }
  if (!hasVisitTime(previous)) {
    return null;
  }
  if (!hasVisitTime(next)) {
    return inferEndVisitTime(items);
  }
  return inferInsertedVisitTime(previous, next);
}

export type DaySlotInsertion = {
  index: number;
  visitTime: string | null;
  isOwnSlot: boolean;
};

// Resolve the slot a drop at `gapIndex` would really use. The dragged item's
// row is hidden while dragging, so gap indexes address the day without it.
// The gap matching the item's original position is its own slot: releasing
// there is a no-op that keeps the current visit time. Untimed drops land at
// the name-sorted spot in the untimed tail regardless of the hovered gap, so
// the preview snaps to that spot instead of showing a position it won't keep.
export function resolveDaySlotInsertion(
  items: ItineraryItem[],
  draggedItem: ItineraryItem | null,
  gapIndex: number,
): DaySlotInsertion {
  if (draggedItem === null) {
    return {
      index: gapIndex,
      visitTime: inferVisitTimeForInsertionIndex(items, gapIndex),
      isOwnSlot: false,
    };
  }

  const draggedId = draggedItem.id;
  const draggedPosition = items.findIndex((item) => item.id === draggedId);
  const remaining =
    draggedPosition === -1
      ? items
      : items.filter((item) => item.id !== draggedId);

  if (draggedPosition !== -1 && gapIndex === draggedPosition) {
    return {
      index: gapIndex,
      visitTime: draggedItem.visit_time,
      isOwnSlot: true,
    };
  }

  const visitTime = inferVisitTimeForInsertionIndex(remaining, gapIndex);
  if (visitTime !== null) {
    return { index: gapIndex, visitTime, isOwnSlot: false };
  }

  const index = predictedUntimedIndex(remaining, draggedItem);
  return {
    index,
    visitTime: null,
    isOwnSlot: draggedPosition !== -1 && index === draggedPosition,
  };
}

function predictedUntimedIndex(
  remaining: ItineraryItem[],
  draggedItem: ItineraryItem,
): number {
  const asUntimed = { ...draggedItem, visit_time: null };
  let index = 0;
  for (const item of remaining) {
    if (compareScheduledItems(item, asUntimed) <= 0) index += 1;
  }
  return index;
}

export function getFirstItemIdForPlace(
  itinerary: ItineraryView,
  placeId: number,
): number | null {
  return (
    getAllItems(itinerary).find((item) => item.place_id === placeId)?.id ?? null
  );
}

function hasVisitTime(
  item: ItineraryItem | null,
): item is ItineraryItem & { visit_time: string } {
  return hasVisitTimeText(item);
}

export { hasVisitTime };

function getAllItems(itinerary: ItineraryView): ItineraryItem[] {
  return [...itinerary.days.flatMap((day) => day.items)];
}
