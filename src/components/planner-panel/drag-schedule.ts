import type { DragEvent } from "react";

import type { ItineraryItem, ItineraryView } from "@/lib/types";
import {
  formatVisitTime,
  hasVisitTimeText,
  parseVisitTime,
} from "@/lib/visit-time";

export const UNSCHEDULED_DROP_TARGET = "unscheduled";

export function hasScheduleDragData(event: DragEvent<HTMLElement>): boolean {
  const types = Array.from(event.dataTransfer.types);
  return types.includes("text/itinerary-item-id");
}

export function isLeavingCurrentTarget(event: DragEvent<HTMLElement>): boolean {
  const nextTarget = event.relatedTarget;

  return !(
    nextTarget instanceof Node && event.currentTarget.contains(nextTarget)
  );
}

export function getDraggedItem(
  event: DragEvent<HTMLElement>,
  itinerary: ItineraryView,
): ItineraryItem | null {
  const id = Number(event.dataTransfer.getData("text/itinerary-item-id"));
  if (!Number.isInteger(id)) return null;

  return getAllItems(itinerary).find((item) => item.id === id) ?? null;
}

export function scheduleDraggedSource(
  event: DragEvent<HTMLElement>,
  options: {
    itinerary: ItineraryView;
    date: string;
    visitTime: string | null;
    onScheduleItem: (
      id: number,
      visitDate: string | null,
      visitTime: string | null,
    ) => void;
  },
) {
  const item = getDraggedItem(event, options.itinerary);
  if (item) {
    options.onScheduleItem(item.id, options.date, options.visitTime);
  }
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

export function scheduleDraggedSourceToDay(
  event: DragEvent<HTMLElement>,
  options: {
    itinerary: ItineraryView;
    date: string;
    onScheduleItem: (
      id: number,
      visitDate: string | null,
      visitTime: string | null,
    ) => void;
  },
) {
  const item = getDraggedItem(event, options.itinerary);
  if (!item) return;

  const schedule = resolveDayDropSchedule(item, options.date);
  if (!schedule) return;

  options.onScheduleItem(item.id, schedule.visitDate, schedule.visitTime);
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

export function insertionDropTargetKey(date: string, index: number): string {
  return `${date}:insert:${index}`;
}

export function endDropTargetKey(date: string): string {
  return `${date}:end`;
}

export function startDropTargetKey(date: string): string {
  return `${date}:start`;
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
