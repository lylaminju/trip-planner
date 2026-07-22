import type { AiTransitHubType, TripTransitPoint } from "./types";
import { formatVisitTime, parseVisitTime } from "./visit-time";

// Minutes to reserve after arriving at a transit point before the first
// attraction can realistically begin. Airports need the most: deplaning,
// immigration, and baggage claim before you even leave the terminal. Travel
// time from the point to the first attraction is added on top of this.
export const AIRPORT_ARRIVAL_BUFFER_MINUTES = 60;
export const DEFAULT_ARRIVAL_BUFFER_MINUTES = 15;

// Minutes you must already be at the departure point before its scheduled time.
// Airports need check-in, security, and boarding; other hubs you can reach much
// closer to departure. Travel time to reach the point is added on top of this.
export const AIRPORT_DEPARTURE_BUFFER_MINUTES = 150;
export const DEFAULT_DEPARTURE_BUFFER_MINUTES = 30;

const DAY_START_MINUTES = 0;
const DAY_END_MINUTES = 23 * 60 + 59;

type TransitTimingPoint = Pick<TripTransitPoint, "hub_type" | "event_time">;

export function arrivalBufferMinutes(hubType: AiTransitHubType | null): number {
  return hubType === "airport"
    ? AIRPORT_ARRIVAL_BUFFER_MINUTES
    : DEFAULT_ARRIVAL_BUFFER_MINUTES;
}

export function departureBufferMinutes(
  hubType: AiTransitHubType | null,
): number {
  return hubType === "airport"
    ? AIRPORT_DEPARTURE_BUFFER_MINUTES
    : DEFAULT_DEPARTURE_BUFFER_MINUTES;
}

// Earliest a first-day attraction may start given the arrival point: the arrival
// time plus the hub's egress buffer. Null when there is no timed arrival point,
// meaning no floor applies.
export function firstDayEarliestStartFromArrival(
  point: TransitTimingPoint | null,
): string | null {
  return shiftEventTime(point, (minutes, hubType) =>
    minutes + arrivalBufferMinutes(hubType),
  );
}

// Latest a last-day attraction may end given the departure point: the departure
// time minus the hub's pre-departure buffer. Null when there is no timed
// departure point, meaning no ceiling applies.
export function lastDayLatestEndFromDeparture(
  point: TransitTimingPoint | null,
): string | null {
  return shiftEventTime(point, (minutes, hubType) =>
    minutes - departureBufferMinutes(hubType),
  );
}

function shiftEventTime(
  point: TransitTimingPoint | null,
  shift: (minutes: number, hubType: AiTransitHubType | null) => number,
): string | null {
  const minutes = parseVisitTime(point?.event_time ?? null);
  if (minutes === null) {
    return null;
  }

  const shifted = shift(minutes, point?.hub_type ?? null);
  const clamped = Math.min(
    Math.max(shifted, DAY_START_MINUTES),
    DAY_END_MINUTES,
  );
  return formatVisitTime(clamped);
}
