const MS_PER_DAY = 86_400_000;

/** Trip start/end as stored on the trip row. */
export type TripDateRange = {
  start_date: string | null;
  end_date: string | null;
};

type ParsedRange = {
  start: number;
  end: number;
};

export type TripDateShiftPlan = {
  deltaDays: number;
  rangeStart: string;
  rangeEnd: string;
};

export type ScheduledVisit = {
  id: number;
  visit_date: string | null;
};

/** A visit that must move; `visit_date: null` drops it back to unscheduled. */
export type VisitDateChange = {
  id: number;
  visit_date: string | null;
};

/**
 * Describes how scheduled visits follow a trip's dates when they change.
 * Returns null when either range is incomplete, since there is no offset to
 * preserve until a trip has both dates.
 */
export function planTripDateShift(
  previous: TripDateRange,
  next: TripDateRange,
): TripDateShiftPlan | null {
  const previousStart = parseIsoDate(previous.start_date);
  const previousEnd = parseIsoDate(previous.end_date);
  const nextStart = parseIsoDate(next.start_date);
  const nextEnd = parseIsoDate(next.end_date);

  if (
    previousStart === null ||
    previousEnd === null ||
    nextStart === null ||
    nextEnd === null
  ) {
    return null;
  }

  return {
    deltaDays: resolveShiftDays(
      { start: previousStart, end: previousEnd },
      { start: nextStart, end: nextEnd },
    ),
    rangeStart: formatIsoDate(nextStart),
    rangeEnd: formatIsoDate(nextEnd),
  };
}

/**
 * Shifts each visit by the plan's delta and unschedules whatever lands outside
 * the new range. Only visits whose date actually changes are returned.
 */
export function applyTripDateShift(
  visits: readonly ScheduledVisit[],
  plan: TripDateShiftPlan,
): VisitDateChange[] {
  const changes: VisitDateChange[] = [];

  for (const visit of visits) {
    const currentTime = parseIsoDate(visit.visit_date);
    if (currentTime === null) {
      continue;
    }

    const shifted = formatIsoDate(currentTime + plan.deltaDays * MS_PER_DAY);
    const nextDate =
      shifted < plan.rangeStart || shifted > plan.rangeEnd ? null : shifted;

    if (nextDate !== visit.visit_date) {
      changes.push({ id: visit.id, visit_date: nextDate });
    }
  }

  return changes;
}

/**
 * How far the plan slides when a trip's dates change.
 *
 * Visits keep their offset from the edge the user left alone, so an untouched
 * end date pins the plan where it is and only the front of the trip changes. A
 * trip that only grows still contains its old range, so nothing has to move
 * there either. Anything else has no fixed edge, and the plan follows the start
 * because trips run forward from arrival.
 */
function resolveShiftDays(previous: ParsedRange, next: ParsedRange): number {
  const endHeld = previous.end === next.end;
  const onlyGrew = next.start <= previous.start && next.end >= previous.end;

  return endHeld || onlyGrew ? 0 : daysBetween(previous.start, next.start);
}

function daysBetween(fromTime: number, toTime: number): number {
  return Math.round((toTime - fromTime) / MS_PER_DAY);
}

function parseIsoDate(value: string | null): number | null {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || formatIsoDate(time) !== value) {
    return null;
  }

  return time;
}

function formatIsoDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}
