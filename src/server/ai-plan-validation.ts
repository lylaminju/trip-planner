import { isValid24HourTime, isValidIsoDate } from "@/app/api/_utils";
import { parseVisitTime } from "@/lib/visit-time";

import type { AiItineraryPlan } from "./openai-ai-planner";

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
  }

  for (const tripDate of context.tripDates) {
    if (!seenDates.has(tripDate)) {
      errors.push(`Day ${tripDate} is missing from the plan.`);
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
