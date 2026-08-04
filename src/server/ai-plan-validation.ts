import { isValid24HourTime, isValidIsoDate } from "@/lib/date-validation";
import { parseVisitTime } from "@/lib/visit-time";

import {
  AI_LUNCH_EARLIEST_START_TIME,
  AI_LUNCH_LATEST_START_TIME,
  AI_LUNCH_MAX_DURATION_MINUTES,
  AI_LUNCH_MIN_DURATION_MINUTES,
  type AiItineraryPlan,
  type AiPlanLunchStop,
} from "./openai-ai-planner";

export type AiPlanValidationResult =
  | { status: "valid"; errors: [] }
  | { status: "invalid"; errors: string[] };

type ValidationContext = {
  candidateIds: ReadonlySet<number>;
  tripDates: readonly string[];
  visitsPerDayMin: number;
  visitsPerDayMax: number;
  mustSeeCandidateIds: readonly number[];
  earliestVisitStartTime?: string | null;
  firstDayEarliestStartTime?: string | null;
  lastDayLatestEndTime?: string | null;
  // Coverage mode: the trip is longer than the catalog supports at the minimum
  // pace, so free days are expected and unplanned dates are allowed. Planned
  // days still follow the per-day pace rules. The arrival/departure days stay
  // required when their transit points exist because batch application anchors
  // those points to the earliest and latest planned dates.
  coverage?: {
    minTotalVisits: number;
    requireFirstTripDate: boolean;
    requireLastTripDate: boolean;
  } | null;
};

export function validateAiItineraryPlan(
  plan: AiItineraryPlan,
  context: ValidationContext,
): AiPlanValidationResult {
  const errors: string[] = [];
  const tripDates = new Set(context.tripDates);
  const seenDates = new Set<string>();
  const seenCandidateIds = new Set<number>();
  const firstTripDate = context.tripDates[0] ?? null;
  const lastTripDate = context.tripDates[context.tripDates.length - 1] ?? null;

  for (const day of plan.days) {
    if (seenDates.has(day.date)) {
      errors.push(`Day ${day.date} appears more than once.`);
    }
    seenDates.add(day.date);

    if (!tripDates.has(day.date)) {
      errors.push(`Day ${day.date} is outside the trip.`);
    }
    if (!isValidIsoDate(day.date)) {
      errors.push(`Day ${day.date} must be YYYY-MM-DD.`);
    }
    if (day.visits.length < context.visitsPerDayMin) {
      errors.push(`Day ${day.date} has fewer visits than requested.`);
    }
    if (day.visits.length > context.visitsPerDayMax) {
      errors.push(`Day ${day.date} has more visits than requested.`);
    }
    const dayEarliestStartTime =
      day.date === firstTripDate && context.firstDayEarliestStartTime
        ? context.firstDayEarliestStartTime
        : context.earliestVisitStartTime;
    const dayLatestEndTime =
      day.date === lastTripDate ? context.lastDayLatestEndTime : null;
    let hasVisitBeforeStartTime = false;
    let hasVisitOutOfOrder = false;
    let previousVisitStartMinutes: number | null = null;

    for (const visit of day.visits) {
      if (!context.candidateIds.has(visit.candidate_id)) {
        errors.push(
          `Candidate ${visit.candidate_id} is not in the curated list.`,
        );
      }
      if (seenCandidateIds.has(visit.candidate_id)) {
        errors.push(`Candidate ${visit.candidate_id} is scheduled more than once.`);
      }
      seenCandidateIds.add(visit.candidate_id);

      if (!isValid24HourTime(visit.start_time)) {
        errors.push(`Visit time ${visit.start_time} must be HH:MM.`);
      }
      if (startsBefore(visit.start_time, dayEarliestStartTime)) {
        hasVisitBeforeStartTime = true;
      }
      const visitStartMinutes = parseVisitTime(visit.start_time);
      if (
        visitStartMinutes !== null &&
        previousVisitStartMinutes !== null &&
        visitStartMinutes <= previousVisitStartMinutes
      ) {
        hasVisitOutOfOrder = true;
      }
      if (visitStartMinutes !== null) {
        previousVisitStartMinutes = visitStartMinutes;
      }
      if (
        !Number.isInteger(visit.duration_minutes) ||
        visit.duration_minutes <= 0
      ) {
        errors.push(
          `Candidate ${visit.candidate_id} duration must be a positive integer.`,
        );
      }
      if (
        dayLatestEndTime &&
        endsAfter(visit.start_time, visit.duration_minutes, dayLatestEndTime)
      ) {
        errors.push(
          `Day ${day.date} has a visit ending after ${dayLatestEndTime}.`,
        );
      }
    }
    if (hasVisitBeforeStartTime && dayEarliestStartTime) {
      errors.push(
        `Day ${day.date} has a visit before ${dayEarliestStartTime}.`,
      );
    }
    if (hasVisitOutOfOrder) {
      errors.push(
        `Day ${day.date} has visits that are not in increasing start-time order.`,
      );
    }
    // Presence is lenient — a null or absent lunch never fails a plan — but a
    // provided lunch must be schedulable: real name, plausible coordinates,
    // and a start inside the lunch window.
    if (day.lunch) {
      errors.push(...lunchErrors(day.date, day.lunch));
    }
  }

  const coverage = context.coverage ?? null;
  for (const tripDate of context.tripDates) {
    if (seenDates.has(tripDate)) continue;
    if (!coverage) {
      errors.push(`Day ${tripDate} is missing from the plan.`);
      continue;
    }
    if (tripDate === firstTripDate && coverage.requireFirstTripDate) {
      errors.push(
        `Day ${tripDate} must be planned because trip_start_point is on that day.`,
      );
    }
    if (tripDate === lastTripDate && coverage.requireLastTripDate) {
      errors.push(
        `Day ${tripDate} must be planned because trip_end_point is on that day.`,
      );
    }
  }

  if (coverage) {
    const totalVisits = plan.days.reduce(
      (total, day) => total + day.visits.length,
      0,
    );
    if (totalVisits < coverage.minTotalVisits) {
      errors.push(
        `Plan schedules only ${totalVisits} visits; schedule at least ${coverage.minTotalVisits} curated candidates.`,
      );
    }
  }

  for (const candidateId of context.mustSeeCandidateIds) {
    if (!seenCandidateIds.has(candidateId)) {
      errors.push(`Must-see candidate ${candidateId} is missing from the plan.`);
    }
  }

  return errors.length === 0
    ? { status: "valid", errors: [] }
    : { status: "invalid", errors };
}

function lunchErrors(date: string, lunch: AiPlanLunchStop): string[] {
  const errors: string[] = [];

  if (lunch.name.trim() === "") {
    errors.push(`Day ${date} lunch must have a restaurant name.`);
  }
  if (!isFiniteInRange(lunch.latitude, -90, 90)) {
    errors.push(`Day ${date} lunch latitude is invalid.`);
  }
  if (!isFiniteInRange(lunch.longitude, -180, 180)) {
    errors.push(`Day ${date} lunch longitude is invalid.`);
  }
  if (!isValid24HourTime(lunch.start_time)) {
    errors.push(`Day ${date} lunch time ${lunch.start_time} must be HH:MM.`);
  } else {
    const startMinutes = parseVisitTime(lunch.start_time);
    const windowStart = parseVisitTime(AI_LUNCH_EARLIEST_START_TIME);
    const windowEnd = parseVisitTime(AI_LUNCH_LATEST_START_TIME);
    if (
      startMinutes === null ||
      windowStart === null ||
      windowEnd === null ||
      startMinutes < windowStart ||
      startMinutes > windowEnd
    ) {
      errors.push(
        `Day ${date} lunch must start between ${AI_LUNCH_EARLIEST_START_TIME} and ${AI_LUNCH_LATEST_START_TIME}.`,
      );
    }
  }
  if (
    !Number.isInteger(lunch.duration_minutes) ||
    lunch.duration_minutes < AI_LUNCH_MIN_DURATION_MINUTES ||
    lunch.duration_minutes > AI_LUNCH_MAX_DURATION_MINUTES
  ) {
    errors.push(
      `Day ${date} lunch duration must be ${AI_LUNCH_MIN_DURATION_MINUTES}-${AI_LUNCH_MAX_DURATION_MINUTES} minutes.`,
    );
  }

  return errors;
}

function isFiniteInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function startsBefore(
  visitStartTime: string,
  earliestVisitStartTime: string | null | undefined,
): boolean {
  if (!earliestVisitStartTime) return false;
  const visitMinutes = parseVisitTime(visitStartTime);
  const startMinutes = parseVisitTime(earliestVisitStartTime);
  return (
    visitMinutes !== null &&
    startMinutes !== null &&
    visitMinutes < startMinutes
  );
}

function endsAfter(
  visitStartTime: string,
  durationMinutes: number,
  latestEndTime: string,
): boolean {
  const visitMinutes = parseVisitTime(visitStartTime);
  const endMinutes = parseVisitTime(latestEndTime);
  if (visitMinutes === null || endMinutes === null) return false;
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) return false;
  return visitMinutes + durationMinutes > endMinutes;
}
