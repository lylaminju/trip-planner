import { compareScheduledPlaces } from "./itinerary";
import type { Place, RouteSegment, TravelMode } from "./types";

export type SegmentInsert = {
  from_place_id: number;
  to_place_id: number;
  mode: TravelMode;
};

export type ReconciliationPlan = {
  toKeepIds: number[];
  toDeleteIds: number[];
  toInsert: SegmentInsert[];
  preservedModes: Map<string, TravelMode>;
};

export function reconcileRouteSegments(
  places: Place[],
  existingSegments: RouteSegment[],
): ReconciliationPlan {
  const desiredPairs = buildDesiredPairs(places);
  const desiredKeys = new Set(desiredPairs.map(([fromPlaceId, toPlaceId]) => pairKey(fromPlaceId, toPlaceId)));
  const keptPairKeys = new Set<string>();

  const toKeepIds: number[] = [];
  const toDeleteIds: number[] = [];
  const preservedModes = new Map<string, TravelMode>();

  for (const segment of existingSegments) {
    const key = pairKey(segment.from_place_id, segment.to_place_id);

    if (!desiredKeys.has(key) || keptPairKeys.has(key)) {
      toDeleteIds.push(segment.id);
      continue;
    }

    keptPairKeys.add(key);
    toKeepIds.push(segment.id);
    preservedModes.set(key, segment.mode);
  }

  const toInsert: SegmentInsert[] = desiredPairs
    .filter(([fromPlaceId, toPlaceId]) => !keptPairKeys.has(pairKey(fromPlaceId, toPlaceId)))
    .map(([fromPlaceId, toPlaceId]) => ({
      from_place_id: fromPlaceId,
      to_place_id: toPlaceId,
      mode: "walking",
    }));

  return { toKeepIds, toDeleteIds, toInsert, preservedModes };
}

function buildDesiredPairs(places: Place[]): Array<[number, number]> {
  const placesByDate = new Map<string, Place[]>();

  for (const place of places) {
    if (!isRoutablePlace(place)) {
      continue;
    }

    const dayPlaces = placesByDate.get(place.visit_date) ?? [];
    dayPlaces.push(place);
    placesByDate.set(place.visit_date, dayPlaces);
  }

  const desiredPairs: Array<[number, number]> = [];

  for (const dayPlaces of placesByDate.values()) {
    const sortedPlaces = [...dayPlaces].sort(compareScheduledPlaces);

    for (let index = 0; index < sortedPlaces.length - 1; index += 1) {
      desiredPairs.push([sortedPlaces[index].id, sortedPlaces[index + 1].id]);
    }
  }

  return desiredPairs;
}

function isRoutablePlace(place: Place): place is Place & { visit_date: string; visit_time: string } {
  return hasVisitDate(place) && hasValidVisitTime(place);
}

function hasVisitDate(place: Place): place is Place & { visit_date: string } {
  return typeof place.visit_date === "string" && place.visit_date.length > 0;
}

function hasVisitTimeText(place: Place): place is Place & { visit_time: string } {
  return typeof place.visit_time === "string" && place.visit_time.length > 0;
}

function hasValidVisitTime(place: Place): place is Place & { visit_time: string } {
  return hasVisitTimeText(place) && parseVisitTime(place.visit_time) !== null;
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

function pairKey(fromPlaceId: number, toPlaceId: number): string {
  return `${fromPlaceId}->${toPlaceId}`;
}
