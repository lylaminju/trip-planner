import {
  formatVisitTime,
  parseVisitTime,
  roundVisitMinutesUpToGrid,
} from "@/lib/visit-time";
import type { Coordinates } from "./ai-plan-batch-rows";

export type GeneratedVisitContext = {
  itemId: number;
  date: string;
  startTime: string;
  location: Coordinates;
  order: number;
};

export type GeneratedRoutePair = {
  from: GeneratedVisitContext;
  to: GeneratedVisitContext;
  isFirstOfDay: boolean;
};

export type TaggedGeneratedRouteSegment = {
  segmentId: number;
  routePair: GeneratedRoutePair;
};

export function buildGeneratedRoutePairs(
  visits: GeneratedVisitContext[],
): GeneratedRoutePair[] {
  const visitsByDate = new Map<string, GeneratedVisitContext[]>();

  for (const visit of visits) {
    if (!Number.isInteger(visit.itemId)) continue;
    const dayVisits = visitsByDate.get(visit.date) ?? [];
    dayVisits.push(visit);
    visitsByDate.set(visit.date, dayVisits);
  }

  const routePairs: GeneratedRoutePair[] = [];
  for (const dayVisits of visitsByDate.values()) {
    const sortedVisits = [...dayVisits].sort(compareGeneratedVisits);
    for (let index = 0; index < sortedVisits.length - 1; index += 1) {
      routePairs.push({
        from: sortedVisits[index],
        to: sortedVisits[index + 1],
        isFirstOfDay: index === 0,
      });
    }
  }

  return routePairs;
}

export function visitTimeAfterRouteDuration(
  fromVisitTime: string,
  toVisitTime: string,
  routeDurationSeconds: number,
): string {
  const fromMinutes = parseVisitTime(fromVisitTime);
  const toMinutes = parseVisitTime(toVisitTime);
  if (fromMinutes === null || toMinutes === null) return toVisitTime;

  const roundedToMinutes = roundVisitMinutesUpToGrid(toMinutes);
  const routeMinutes = Math.ceil(routeDurationSeconds / 60);
  if (!Number.isFinite(routeMinutes) || routeMinutes < 0) {
    return formatVisitTime(roundedToMinutes);
  }

  const earliestArrivalMinutes = roundVisitMinutesUpToGrid(
    fromMinutes + routeMinutes,
  );
  const adjustedMinutes = Math.max(roundedToMinutes, earliestArrivalMinutes);
  return toMinutes === adjustedMinutes
    ? toVisitTime
    : formatVisitTime(adjustedMinutes);
}

export function routePairKey(fromItemId: number, toItemId: number): string {
  return `${fromItemId}->${toItemId}`;
}

function compareGeneratedVisits(
  left: GeneratedVisitContext,
  right: GeneratedVisitContext,
): number {
  return (
    left.startTime.localeCompare(right.startTime) ||
    left.order - right.order ||
    left.itemId - right.itemId
  );
}
