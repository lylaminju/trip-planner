import type {
  ItineraryDay,
  ItineraryItem,
  ItineraryView,
  Place,
  RouteSegment,
  SegmentView,
} from "./types";

const DAY_COLOR_PALETTE = [
  "#dc2626",
  "#d6a100",
  "#15803d",
  "#2563eb",
  "#7c3aed",
  "#0f766e",
  "#be185d",
] as const;

export function buildItinerary(
  items: ItineraryItem[],
  routeSegments: RouteSegment[],
  places: Place[] = [],
): ItineraryView {
  const scheduled = items.filter(hasVisitDate);
  const scheduledPlaceIds = new Set(scheduled.map((item) => item.place_id));
  const unscheduled = places
    .filter((place) => !scheduledPlaceIds.has(place.id))
    .sort(comparePlacesByName);

  const dates = Array.from(
    new Set(scheduled.map((item) => item.visit_date)),
  ).sort();
  const segmentsByPair = new Map(
    routeSegments.map((segment) => [
      pairKey(segment.from_item_id, segment.to_item_id),
      segment,
    ]),
  );

  const days: ItineraryDay[] = dates.map((date, index) => {
    const dayItems = scheduled
      .filter((item) => item.visit_date === date)
      .sort(compareScheduledItems);

    return {
      date,
      color: getDayColor(index, dates.length),
      items: dayItems,
      segments: buildSegmentViews(dayItems, segmentsByPair),
    };
  });

  return { days, unscheduled };
}

export function compareScheduledItems(
  a: ItineraryItem,
  b: ItineraryItem,
): number {
  const aTimed = hasValidVisitTime(a);
  const bTimed = hasValidVisitTime(b);

  if (aTimed !== bTimed) {
    return aTimed ? -1 : 1;
  }

  if (aTimed && bTimed) {
    const timeComparison = compareVisitTimes(a, b);

    if (timeComparison !== 0) {
      return timeComparison;
    }
  }

  return compareByName(a, b);
}

const compareScheduledPlaces = compareScheduledItems;
export { compareScheduledPlaces };

function buildSegmentViews(
  items: ItineraryItem[],
  segmentsByPair: Map<string, RouteSegment>,
): SegmentView[] {
  const timedItems = items.filter(hasValidVisitTime);
  const views: SegmentView[] = [];

  for (let index = 0; index < timedItems.length - 1; index += 1) {
    const from = timedItems[index];
    const to = timedItems[index + 1];
    const segment = segmentsByPair.get(pairKey(from.id, to.id));

    if (segment) {
      views.push({ fromItemId: from.id, toItemId: to.id, segment });
    }
  }

  return views;
}

function compareByName(a: ItineraryItem, b: ItineraryItem): number {
  return a.place.name.localeCompare(b.place.name, undefined, {
    sensitivity: "base",
  });
}

function comparePlacesByName(a: Place, b: Place): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
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
  return hasVisitTimeText(item) && getVisitTimeMinutes(item) !== null;
}

function compareVisitTimes(
  a: ItineraryItem & { visit_time: string },
  b: ItineraryItem & { visit_time: string },
): number {
  if (a.visit_time === b.visit_time) {
    return 0;
  }

  const aMinutes = getVisitTimeMinutes(a);
  const bMinutes = getVisitTimeMinutes(b);

  if (aMinutes !== null && bMinutes !== null) {
    return aMinutes - bMinutes;
  }

  if (aMinutes !== null) {
    return -1;
  }

  if (bMinutes !== null) {
    return 1;
  }

  return a.visit_time.localeCompare(b.visit_time, undefined, {
    sensitivity: "base",
  });
}

function getVisitTimeMinutes(
  item: ItineraryItem & { visit_time: string },
): number | null {
  return parseVisitTime(item.visit_time);
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

function getDayColor(index: number, _totalDays: number): string {
  return DAY_COLOR_PALETTE[index % DAY_COLOR_PALETTE.length];
}
