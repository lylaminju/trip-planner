import { compareScheduledItems } from "./itinerary";
import type { ItineraryItem, RouteSegment, TravelMode } from "./types";

export type SegmentInsert = {
  from_item_id: number;
  to_item_id: number;
  mode: TravelMode;
};

export type ReconciliationPlan = {
  toKeepIds: number[];
  toDeleteIds: number[];
  toInsert: SegmentInsert[];
  preservedModes: Map<string, TravelMode>;
};

export function reconcileRouteSegments(
  items: ItineraryItem[],
  existingSegments: RouteSegment[],
): ReconciliationPlan {
  const desiredPairs = buildDesiredPairs(items);
  const desiredKeys = new Set(
    desiredPairs.map(([fromItemId, toItemId]) => pairKey(fromItemId, toItemId)),
  );
  const keptPairKeys = new Set<string>();

  const toKeepIds: number[] = [];
  const toDeleteIds: number[] = [];
  const preservedModes = new Map<string, TravelMode>();

  for (const segment of existingSegments) {
    const key = pairKey(segment.from_item_id, segment.to_item_id);

    if (!desiredKeys.has(key) || keptPairKeys.has(key)) {
      toDeleteIds.push(segment.id);
      continue;
    }

    keptPairKeys.add(key);
    toKeepIds.push(segment.id);
    preservedModes.set(key, segment.mode);
  }

  const toInsert: SegmentInsert[] = desiredPairs
    .filter(
      ([fromItemId, toItemId]) =>
        !keptPairKeys.has(pairKey(fromItemId, toItemId)),
    )
    .map(([fromItemId, toItemId]) => ({
      from_item_id: fromItemId,
      to_item_id: toItemId,
      mode: "walking",
    }));

  return { toKeepIds, toDeleteIds, toInsert, preservedModes };
}

function buildDesiredPairs(items: ItineraryItem[]): Array<[number, number]> {
  const itemsByDate = new Map<string, ItineraryItem[]>();

  for (const item of items) {
    if (!isRoutableItem(item)) {
      continue;
    }

    const dayItems = itemsByDate.get(item.visit_date) ?? [];
    dayItems.push(item);
    itemsByDate.set(item.visit_date, dayItems);
  }

  const desiredPairs: Array<[number, number]> = [];

  for (const dayItems of itemsByDate.values()) {
    const sortedItems = [...dayItems].sort(compareScheduledItems);

    for (let index = 0; index < sortedItems.length - 1; index += 1) {
      desiredPairs.push([sortedItems[index].id, sortedItems[index + 1].id]);
    }
  }

  return desiredPairs;
}

function isRoutableItem(
  item: ItineraryItem,
): item is ItineraryItem & { visit_date: string; visit_time: string } {
  return hasVisitDate(item) && hasValidVisitTime(item);
}

function hasVisitDate(
  item: ItineraryItem,
): item is ItineraryItem & { visit_date: string } {
  return typeof item.visit_date === "string" && item.visit_date.length > 0;
}

function hasVisitTimeText(
  item: ItineraryItem,
): item is ItineraryItem & { visit_time: string } {
  return typeof item.visit_time === "string" && item.visit_time.length > 0;
}

function hasValidVisitTime(
  item: ItineraryItem,
): item is ItineraryItem & { visit_time: string } {
  return hasVisitTimeText(item) && parseVisitTime(item.visit_time) !== null;
}

function parseVisitTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function pairKey(fromItemId: number, toItemId: number): string {
  return `${fromItemId}->${toItemId}`;
}
