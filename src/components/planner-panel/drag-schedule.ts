import type { DragEvent } from "react";

import type { ItineraryItem, ItineraryView } from "@/lib/types";

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

export function insertionDropTargetKey(date: string, index: number): string {
  return `${date}:insert:${index}`;
}

export function endDropTargetKey(date: string): string {
  return `${date}:end`;
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
  return typeof item?.visit_time === "string" && item.visit_time.length > 0;
}

export { hasVisitTime };

function parseVisitTime(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function formatVisitTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function getAllItems(itinerary: ItineraryView): ItineraryItem[] {
  return [...itinerary.days.flatMap((day) => day.items)];
}
