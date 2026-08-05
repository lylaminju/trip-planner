import {
  formatVisitTime,
  parseVisitTime,
  roundVisitMinutesUpToGrid,
} from "@/lib/visit-time";

import {
  AI_LUNCH_EARLIEST_START_TIME,
  AI_LUNCH_LATEST_START_TIME,
  type AiItineraryPlan,
  type AiPlanLunchSlot,
} from "./openai-ai-planner";

/**
 * Keeps a day's lunch slot from landing inside an attraction visit. The prompt
 * already forbids the overlap, but nothing downstream measures it: validation
 * and batch row building both order stops by start time alone, so a long visit
 * looks finished the moment the clock passes its start and lunch can be
 * scheduled halfway through it.
 *
 * A bad lunch time never fails a generation, so this repairs the plan instead
 * of rejecting it, and a day it cannot repair keeps the model's times.
 */

type PlanDay = AiItineraryPlan["days"][number];
type PlanVisit = PlanDay["visits"][number];

type VisitSpan = { start: number; end: number };

export type LunchScheduleOptions = {
  // The departure-day deadline validation already enforced. Moving a visit
  // later must not push the last day past it.
  lastTripDate?: string | null;
  lastDayLatestEndTime?: string | null;
};

const MINUTES_PER_DAY = 1_440;

const LUNCH_WINDOW = {
  earliest: requireMinutes(AI_LUNCH_EARLIEST_START_TIME),
  latest: requireMinutes(AI_LUNCH_LATEST_START_TIME),
};

export function withLunchClearOfVisits(
  plan: AiItineraryPlan,
  options: LunchScheduleOptions = {},
): AiItineraryPlan {
  return {
    days: plan.days.map((day) => dayWithLunchClearOfVisits(day, options)),
  };
}

function dayWithLunchClearOfVisits(
  day: PlanDay,
  options: LunchScheduleOptions,
): PlanDay {
  const lunch = day.lunch;
  if (!lunch) return day;

  const lunchStart = parseVisitTime(lunch.start_time);
  if (lunchStart === null) return day;

  const spans = visitSpans(day);
  // Visits are validated into increasing start-time order, so the first
  // overlapping span is the one lunch runs into.
  const blocking = spans.find((span) =>
    overlaps(span, lunchStart, lunchStart + lunch.duration_minutes),
  );
  if (!blocking) return day;

  return (
    lunchAfterBlockingVisit(day, lunch, blocking, spans) ??
    lunchBeforeBlockingVisit(day, lunch, blocking, spans, options) ??
    day
  );
}

/**
 * Least invasive repair: lunch waits until the blocking visit is over. Only
 * works when that visit ends early enough to still be lunch.
 */
function lunchAfterBlockingVisit(
  day: PlanDay,
  lunch: AiPlanLunchSlot,
  blocking: VisitSpan,
  spans: VisitSpan[],
): PlanDay | null {
  const start = roundVisitMinutesUpToGrid(blocking.end);
  if (!isWithinLunchWindow(start)) return null;
  if (spans.some((span) => overlaps(span, start, start + lunch.duration_minutes))) {
    return null;
  }

  return { ...day, lunch: { ...lunch, start_time: formatVisitTime(start) } };
}

/**
 * Lunch takes the blocking visit's slot and the visit resumes when lunch ends,
 * carrying the rest of the day with it. The traveler is already in that area at
 * that time — the model scheduled the visit there and every lunch candidate
 * sits within the day's detour bound — so the visit's own start is the one time
 * we know is workable for lunch.
 */
function lunchBeforeBlockingVisit(
  day: PlanDay,
  lunch: AiPlanLunchSlot,
  blocking: VisitSpan,
  spans: VisitSpan[],
  options: LunchScheduleOptions,
): PlanDay | null {
  const start = blocking.start;
  if (!isWithinLunchWindow(start)) return null;

  const end = start + lunch.duration_minutes;
  // Visits that keep their times are the ones before the blocking visit; lunch
  // has to clear those on its own.
  const kept = spans.filter((span) => span.start < blocking.start);
  if (kept.some((span) => overlaps(span, start, end))) return null;

  const shift = roundVisitMinutesUpToGrid(end) - blocking.start;
  if (shift <= 0) return null;

  const shifted = spans.filter((span) => span.start >= blocking.start);
  const latestShiftedEnd = Math.max(...shifted.map((span) => span.end)) + shift;
  if (latestShiftedEnd > latestEndMinutes(day.date, options)) return null;

  return {
    ...day,
    visits: day.visits.map((visit) => shiftedVisit(visit, blocking.start, shift)),
    lunch: { ...lunch, start_time: formatVisitTime(start) },
  };
}

function shiftedVisit(
  visit: PlanVisit,
  fromStartMinutes: number,
  shiftMinutes: number,
): PlanVisit {
  const start = parseVisitTime(visit.start_time);
  if (start === null || start < fromStartMinutes) return visit;
  return { ...visit, start_time: formatVisitTime(start + shiftMinutes) };
}

function visitSpans(day: PlanDay): VisitSpan[] {
  const spans: VisitSpan[] = [];
  for (const visit of day.visits) {
    const start = parseVisitTime(visit.start_time);
    if (start === null) continue;
    const duration =
      Number.isInteger(visit.duration_minutes) && visit.duration_minutes > 0
        ? visit.duration_minutes
        : 0;
    spans.push({ start, end: start + duration });
  }
  return spans;
}

function overlaps(span: VisitSpan, start: number, end: number): boolean {
  return span.start < end && start < span.end;
}

function isWithinLunchWindow(minutes: number): boolean {
  return minutes >= LUNCH_WINDOW.earliest && minutes <= LUNCH_WINDOW.latest;
}

function latestEndMinutes(
  date: string,
  options: LunchScheduleOptions,
): number {
  if (!options.lastTripDate || date !== options.lastTripDate) {
    return MINUTES_PER_DAY;
  }
  return parseVisitTime(options.lastDayLatestEndTime ?? null) ?? MINUTES_PER_DAY;
}

function requireMinutes(time: string): number {
  const minutes = parseVisitTime(time);
  if (minutes === null) {
    throw new Error(`Lunch window bound ${time} must be HH:MM.`);
  }
  return minutes;
}
