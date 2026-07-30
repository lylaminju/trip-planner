import { isValid24HourTime, isValidIsoDate } from "./date-validation";

// Transit durations depend on when you travel, so a cached transit route is only
// meaningful alongside the departure it was computed for. Rows are therefore
// bucketed by local weekday and hour: a Saturday 10:00 hop is reusable across
// trips and across weeks, while a Tuesday 23:00 hop is a different answer.
export type TransitDeparture = {
  // Cache-key suffix identifying which departure this row describes.
  bucket: string;
  // RFC3339 instant for the Routes API departureTime field, or null when the
  // local time cannot be resolved and the request must fall back to "now".
  departureTime: string | null;
};

// Used when no departure can be resolved: either the destination has no IANA
// zone (custom Google destinations) or the item is unscheduled. Such rows hold
// a "leaving now" estimate, and the bucket says so rather than pretending the
// row belongs to a specific weekday and hour.
export const TRANSIT_BUCKET_NOW = "now";

// Routes API limits for transit departureTime: "up to and including 7 days
// prior to now; up to and including 100 days after now".
const GOOGLE_TRANSIT_PAST_LIMIT_DAYS = 7;
const GOOGLE_TRANSIT_FUTURE_LIMIT_DAYS = 100;
// Trips outside the API window are shifted by whole weeks, which preserves
// weekday and wall-clock hour. Placement stays inside these softer bounds so a
// daylight-saving shift of an hour cannot push a request past the hard limits.
const PLACEMENT_MIN_DAYS = 1;
const PLACEMENT_MAX_DAYS = 95;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

const WEEKDAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function resolveTransitDeparture(input: {
  visitDate: string | null;
  visitTime: string | null;
  timeZone: string | null;
  now: Date;
}): TransitDeparture {
  const { visitDate, visitTime, timeZone } = input;
  if (
    !visitDate ||
    !visitTime ||
    !timeZone ||
    !isValidIsoDate(visitDate) ||
    !isValid24HourTime(visitTime)
  ) {
    return { bucket: TRANSIT_BUCKET_NOW, departureTime: null };
  }

  const departureMs = placedDepartureMs(
    visitDate,
    visitTime,
    timeZone,
    input.now.getTime(),
  );
  if (departureMs === null) {
    return { bucket: TRANSIT_BUCKET_NOW, departureTime: null };
  }

  return {
    bucket: localBucket(visitDate, visitTime),
    departureTime: new Date(departureMs).toISOString(),
  };
}

// Bucket comes from the stored local wall clock, not from the resolved instant,
// so the same weekday and hour always maps to one row no matter which week the
// request had to be placed in.
function localBucket(visitDate: string, visitTime: string): string {
  const weekday = WEEKDAY_NAMES[new Date(`${visitDate}T00:00:00Z`).getUTCDay()];
  return `${weekday}-${visitTime.slice(0, 2)}`;
}

function placedDepartureMs(
  visitDate: string,
  visitTime: string,
  timeZone: string,
  nowMs: number,
): number | null {
  const scheduled = wallClockToUtcMs(visitDate, visitTime, timeZone);
  if (scheduled === null) return null;

  const earliest = nowMs + PLACEMENT_MIN_DAYS * MS_PER_DAY;
  const latest = nowMs + PLACEMENT_MAX_DAYS * MS_PER_DAY;
  if (scheduled >= earliest && scheduled <= latest) return scheduled;

  // Shift whole weeks toward the window so weekday and hour survive, then
  // re-resolve the wall clock on the shifted date to pick up any offset change.
  const weeks =
    scheduled > latest
      ? -Math.ceil((scheduled - latest) / MS_PER_WEEK)
      : Math.ceil((earliest - scheduled) / MS_PER_WEEK);
  const shifted = wallClockToUtcMs(
    shiftIsoDateByWeeks(visitDate, weeks),
    visitTime,
    timeZone,
  );
  if (shifted === null) return null;

  const hardEarliest = nowMs - GOOGLE_TRANSIT_PAST_LIMIT_DAYS * MS_PER_DAY;
  const hardLatest = nowMs + GOOGLE_TRANSIT_FUTURE_LIMIT_DAYS * MS_PER_DAY;
  return shifted >= hardEarliest && shifted <= hardLatest ? shifted : null;
}

function shiftIsoDateByWeeks(visitDate: string, weeks: number): string {
  const shifted = new Date(
    Date.parse(`${visitDate}T00:00:00Z`) + weeks * MS_PER_WEEK,
  );
  return shifted.toISOString().slice(0, 10);
}

// Interprets "YYYY-MM-DD HH:MM" as a wall clock in timeZone and returns the UTC
// instant. Two offset probes settle the answer across daylight-saving changes:
// the first uses the naive guess, the second the corrected instant.
function wallClockToUtcMs(
  visitDate: string,
  visitTime: string,
  timeZone: string,
): number | null {
  const naive = Date.parse(`${visitDate}T${visitTime}:00Z`);
  if (Number.isNaN(naive)) return null;

  try {
    const firstPass = naive - zoneOffsetMs(naive, timeZone);
    return naive - zoneOffsetMs(firstPass, timeZone);
  } catch {
    // Intl throws RangeError on an unknown zone id.
    return null;
  }
}

function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));

  const field = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value);

  return (
    Date.UTC(
      field("year"),
      field("month") - 1,
      field("day"),
      field("hour"),
      field("minute"),
      field("second"),
    ) - utcMs
  );
}
