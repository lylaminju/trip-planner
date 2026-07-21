import { straightLineDistanceKm } from "./geo-distance";
import { compareScheduledItems } from "./itinerary";
import type { ItineraryItem, RouteSegment, TravelMode } from "./types";
import { hasValidVisitTime, hasVisitDate } from "./visit-time";

// Keep in sync with walking_distance_max_km in the
// reconcile_route_segments_for_trip function in supabase/schema.sql.
const MAX_DEFAULT_WALKING_DISTANCE_KM = 2;

export type SegmentInsert = {
  from_item_id: number;
  to_item_id: number;
  mode: TravelMode;
};

export type ReconciliationPlan = {
  toDeleteIds: number[];
  toInsert: SegmentInsert[];
};

export function isOptimisticSegmentId(id: number): boolean {
  return id < 0;
}

export function applyOptimisticReconciliation(
  items: ItineraryItem[],
  segments: RouteSegment[],
  tripId: number,
): RouteSegment[] {
  const { toDeleteIds, toInsert } = reconcileRouteSegments(items, segments);

  if (toDeleteIds.length === 0 && toInsert.length === 0) {
    return segments;
  }

  const deletedIds = new Set(toDeleteIds);
  const kept = segments.filter((segment) => !deletedIds.has(segment.id));
  const timestamp = new Date().toISOString();
  let nextId = Math.min(0, ...segments.map((segment) => segment.id)) - 1;

  const placeholders = toInsert.map((insert) => {
    const placeholder: RouteSegment = {
      id: nextId,
      trip_id: tripId,
      from_item_id: insert.from_item_id,
      to_item_id: insert.to_item_id,
      mode: insert.mode,
      created_at: timestamp,
      updated_at: timestamp,
    };
    nextId -= 1;
    return placeholder;
  });

  return [...kept, ...placeholders];
}

export function reconcileRouteSegments(
  items: ItineraryItem[],
  existingSegments: RouteSegment[],
): ReconciliationPlan {
  const desiredPairs = buildDesiredPairs(items);
  const desiredKeys = new Set(
    desiredPairs.map(([from, to]) => pairKey(from.id, to.id)),
  );
  const keptPairKeys = new Set<string>();

  const toDeleteIds: number[] = [];

  for (const segment of existingSegments) {
    const key = pairKey(segment.from_item_id, segment.to_item_id);

    if (!desiredKeys.has(key) || keptPairKeys.has(key)) {
      toDeleteIds.push(segment.id);
      continue;
    }

    keptPairKeys.add(key);
  }

  const toInsert: SegmentInsert[] = desiredPairs
    .filter(([from, to]) => !keptPairKeys.has(pairKey(from.id, to.id)))
    .map(([from, to]) => ({
      from_item_id: from.id,
      to_item_id: to.id,
      mode: defaultRouteMode(from, to),
    }));

  return { toDeleteIds, toInsert };
}

function buildDesiredPairs(
  items: ItineraryItem[],
): Array<[ItineraryItem, ItineraryItem]> {
  const itemsByDate = new Map<string, ItineraryItem[]>();

  for (const item of items) {
    if (!isRoutableItem(item)) {
      continue;
    }

    const dayItems = itemsByDate.get(item.visit_date) ?? [];
    dayItems.push(item);
    itemsByDate.set(item.visit_date, dayItems);
  }

  const desiredPairs: Array<[ItineraryItem, ItineraryItem]> = [];

  for (const dayItems of itemsByDate.values()) {
    const sortedItems = [...dayItems].sort(compareScheduledItems);

    for (let index = 0; index < sortedItems.length - 1; index += 1) {
      desiredPairs.push([sortedItems[index], sortedItems[index + 1]]);
    }
  }

  return desiredPairs;
}

function defaultRouteMode(from: ItineraryItem, to: ItineraryItem): TravelMode {
  return straightLineDistanceKm(from.place, to.place) >
    MAX_DEFAULT_WALKING_DISTANCE_KM
    ? "driving"
    : "walking";
}

function isRoutableItem(
  item: ItineraryItem,
): item is ItineraryItem & { visit_date: string; visit_time: string } {
  return hasVisitDate(item) && hasValidVisitTime(item);
}

function pairKey(fromItemId: number, toItemId: number): string {
  return `${fromItemId}->${toItemId}`;
}
