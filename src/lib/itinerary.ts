import type {
  ItineraryDay,
  ItineraryView,
  Place,
  RouteSegment,
  SegmentView,
} from "./types";

const DAY_COLORS = [
  "#0f766e",
  "#2563eb",
  "#b45309",
  "#7c3aed",
  "#be123c",
  "#15803d",
  "#0369a1",
];

export function buildItinerary(places: Place[], routeSegments: RouteSegment[]): ItineraryView {
  const scheduled = places.filter(hasVisitDate);
  const unscheduled = places.filter((place) => !hasVisitDate(place)).sort(compareByName);

  const dates = Array.from(new Set(scheduled.map((place) => place.visit_date))).sort();
  const segmentsByPair = new Map(
    routeSegments.map((segment) => [pairKey(segment.from_place_id, segment.to_place_id), segment]),
  );

  const days: ItineraryDay[] = dates.map((date, index) => {
    const dayPlaces = scheduled
      .filter((place) => place.visit_date === date)
      .sort(compareScheduledPlaces);

    return {
      date,
      color: getDayColor(date),
      places: dayPlaces,
      segments: buildSegmentViews(dayPlaces, segmentsByPair),
    };
  });

  return { days, unscheduled };
}

export function compareScheduledPlaces(a: Place, b: Place): number {
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

function buildSegmentViews(
  places: Place[],
  segmentsByPair: Map<string, RouteSegment>,
): SegmentView[] {
  const timedPlaces = places.filter(hasValidVisitTime);
  const views: SegmentView[] = [];

  for (let index = 0; index < timedPlaces.length - 1; index += 1) {
    const from = timedPlaces[index];
    const to = timedPlaces[index + 1];
    const segment = segmentsByPair.get(pairKey(from.id, to.id));

    if (segment) {
      views.push({ fromPlaceId: from.id, toPlaceId: to.id, segment });
    }
  }

  return views;
}

function compareByName(a: Place, b: Place): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function hasVisitDate(place: Place): place is Place & { visit_date: string } {
  return typeof place.visit_date === "string" && place.visit_date.length > 0;
}

function hasVisitTimeText(place: Place): place is Place & { visit_time: string } {
  return typeof place.visit_time === "string" && place.visit_time.length > 0;
}

function hasValidVisitTime(place: Place): place is Place & { visit_time: string } {
  return hasVisitTimeText(place) && getVisitTimeMinutes(place) !== null;
}

function compareVisitTimes(a: Place & { visit_time: string }, b: Place & { visit_time: string }): number {
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

  return a.visit_time.localeCompare(b.visit_time, undefined, { sensitivity: "base" });
}

function getVisitTimeMinutes(place: Place & { visit_time: string }): number | null {
  return parseVisitTime(place.visit_time);
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

function getDayColor(date: string): string {
  const epochDay = getEpochDay(date);

  if (epochDay !== null) {
    return DAY_COLORS[Math.abs(epochDay) % DAY_COLORS.length];
  }

  return DAY_COLORS[Math.abs(hashString(date)) % DAY_COLORS.length];
}

function getEpochDay(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
    return null;
  }

  const utcTime = Date.UTC(year, monthIndex, day);
  const parsed = new Date(utcTime);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== monthIndex ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return Math.trunc(utcTime / 86_400_000);
}

function hashString(value: string): number {
  let hash = 0;

  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }

  return hash;
}
