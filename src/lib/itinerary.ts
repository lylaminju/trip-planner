import type {
  ItineraryDay,
  ItineraryItem,
  ItineraryView,
  Place,
  RouteSegment,
  SegmentView,
  VisitDateOption,
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

export type ItineraryDateRange = {
  startDate: string | null;
  endDate: string | null;
};

export function buildVisitDateOptions(
  dateRange: ItineraryDateRange | undefined,
): VisitDateOption[] {
  return buildDateRange(dateRange).map((date, index) => ({
    value: date,
    label: `Day ${index + 1} · ${formatVisitDateOptionDate(date)}`,
  }));
}

export function buildItinerary(
  items: ItineraryItem[],
  routeSegments: RouteSegment[],
  places: Place[] = [],
  dateRange?: ItineraryDateRange,
): ItineraryView {
  const scheduled = items.filter(hasVisitDate);
  const scheduledPlaceIds = new Set(scheduled.map((item) => item.place_id));
  const unscheduled = places
    .filter((place) => !scheduledPlaceIds.has(place.id))
    .sort(comparePlacesByName);

  const scheduledDates = Array.from(
    new Set(scheduled.map((item) => item.visit_date)),
  ).sort();
  const tripDates = buildDateRange(dateRange);
  const tripDateSet = new Set(tripDates);
  const dates =
    tripDates.length > 0
      ? [
          ...tripDates,
          ...scheduledDates.filter((date) => !tripDateSet.has(date)),
        ]
      : scheduledDates;
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

function buildDateRange(dateRange: ItineraryDateRange | undefined): string[] {
  if (!dateRange?.startDate || !dateRange.endDate) {
    return [];
  }

  const start = parseIsoDate(dateRange.startDate);
  const end = parseIsoDate(dateRange.endDate);
  if (!start || !end || start.time > end.time) {
    return [];
  }

  const dates: string[] = [];
  const oneDayMs = 24 * 60 * 60 * 1000;
  for (let time = start.time; time <= end.time; time += oneDayMs) {
    dates.push(formatIsoDate(time));
  }

  return dates;
}

function parseIsoDate(value: string): { time: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time)) {
    return null;
  }

  if (formatIsoDate(time) !== value) {
    return null;
  }

  return { time };
}

function formatIsoDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function formatVisitDateOptionDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}
