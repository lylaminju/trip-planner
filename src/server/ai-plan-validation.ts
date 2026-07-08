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
  firstVisitAfterTime?: string | null;
};

export function validateAiItineraryPlan(
  plan: AiItineraryPlan,
  context: ValidationContext,
): AiPlanValidationResult {
  const errors: string[] = [];
  const tripDates = new Set(context.tripDates);
  const seenDates = new Set<string>();
  const seenCandidateIds = new Set<number>();

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
    let hasVisitAtOrBeforeStartTime = false;

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
      if (startsAtOrBefore(visit.start_time, context.firstVisitAfterTime)) {
        hasVisitAtOrBeforeStartTime = true;
      }
      if (
        !Number.isInteger(visit.duration_minutes) ||
        visit.duration_minutes <= 0
      ) {
        errors.push(
          `Candidate ${visit.candidate_id} duration must be a positive integer.`,
        );
      }
    }
    if (hasVisitAtOrBeforeStartTime && context.firstVisitAfterTime) {
      errors.push(
        `Day ${day.date} has a visit that does not start after ${context.firstVisitAfterTime}.`,
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

function startsAtOrBefore(
  visitStartTime: string,
  firstVisitAfterTime: string | null | undefined,
): boolean {
  if (!firstVisitAfterTime) return false;
  const visitMinutes = parseVisitTime(visitStartTime);
  const startMinutes = parseVisitTime(firstVisitAfterTime);
  return (
    visitMinutes !== null &&
    startMinutes !== null &&
    visitMinutes <= startMinutes
  );
}
