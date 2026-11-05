const MS_PER_DAY = 86_400_000;

/** Trip start/end as stored on the trip row. */
export type TripDateRange = {
  start_date: string | null;
  end_date: string | null;
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

/** A scheduled visit that must move, without losing its schedule. */
export type VisitDateChange = {
  id: number;
  visit_date: string;
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
    nextEnd === null ||
    previousStart > previousEnd ||
    nextStart > nextEnd
  ) {
    return null;
  }

  return {
    deltaDays: daysBetween(previousStart, nextStart),
    rangeStart: formatIsoDate(nextStart),
    rangeEnd: formatIsoDate(nextEnd),
  };
}

/**
 * Rejects edits that would strand a scheduled visit. Shared by the form and
 * server so a shorter period never silently discards part of an itinerary.
 */
export function getTripDateChangeError(
  previous: TripDateRange,
  next: TripDateRange,
  visits: readonly ScheduledVisit[],
): string | null {
  if (
    previous.start_date === next.start_date &&
    previous.end_date === next.end_date
  ) {
    return null;
  }

  const nextStart = parseIsoDate(next.start_date);
  const nextEnd = parseIsoDate(next.end_date);
  if (
    (next.start_date !== null && nextStart === null) ||
    (next.end_date !== null && nextEnd === null)
  ) {
    return "Trip dates must use valid YYYY-MM-DD dates.";
  }
  if (nextStart !== null && nextEnd !== null && nextStart > nextEnd) {
    return "Trip start date must be before or equal to end date.";
  }

  const scheduled = visits.filter((visit) => visit.visit_date !== null);
  if (scheduled.length === 0) return null;
  if (nextStart === null || nextEnd === null) {
    return "Select both trip dates to keep your scheduled visits.";
  }

  const plan = planTripDateShift(previous, next);
  let lastVisit = nextStart;
  for (const visit of scheduled) {
    const currentTime = parseIsoDate(visit.visit_date);
    if (currentTime === null) {
      return "A visit has an invalid date. Update it before changing the trip dates.";
    }
    // Without a complete previous range, retain the existing calendar date.
    const shifted = currentTime + (plan?.deltaDays ?? 0) * MS_PER_DAY;
    if (shifted < nextStart) {
      return "Some visits fall before the new trip dates. Move those visits first.";
    }
    lastVisit = Math.max(lastVisit, shifted);
  }

  if (lastVisit > nextEnd) {
    if (plan === null) {
      return "Some visits fall after the new trip dates. Extend the trip or move those visits first.";
    }
    const requiredDays = daysBetween(nextStart, lastVisit) + 1;
    return `Your itinerary includes Day ${requiredDays}. Keep at least ${requiredDays} days or move those visits before changing the trip dates.`;
  }
  return null;
}

/**
 * Shifts visits by one delta, preserving day numbers, grouping, and ordering.
 * Rejects out-of-range changes instead of silently unscheduling visits.
 */
export function applyTripDateShift(
  visits: readonly ScheduledVisit[],
  plan: TripDateShiftPlan,
): VisitDateChange[] {
  const changes: VisitDateChange[] = [];

  for (const visit of visits) {
    if (visit.visit_date === null) continue;
    const currentTime = parseIsoDate(visit.visit_date);
    if (currentTime === null) {
      throw new Error("Cannot shift a visit with an invalid date.");
    }

    const shifted = formatIsoDate(currentTime + plan.deltaDays * MS_PER_DAY);
    if (shifted < plan.rangeStart || shifted > plan.rangeEnd) {
      throw new Error("A scheduled visit falls outside the new trip dates.");
    }

    if (shifted !== visit.visit_date) {
      changes.push({ id: visit.id, visit_date: shifted });
    }
  }

  return changes;
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
