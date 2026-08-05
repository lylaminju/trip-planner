import { isAiInterestTag } from "@/lib/ai-planning-preferences";
import type {
  AiDestinationCandidate,
  AiPlanningPreferenceInput,
  Trip,
  TripLodging,
  TripTransitPoint,
} from "@/lib/types";

import { transitPointPromptContext } from "./ai-planning-transit-points";
import type { AiPlannerPromptContext } from "./openai-ai-planner";

export function promptContext(input: {
  trip: Trip;
  lodging: TripLodging | null;
  arrivalPoint: TripTransitPoint | null;
  departurePoint: TripTransitPoint | null;
  candidates: AiDestinationCandidate[];
  preferences: AiPlanningPreferenceInput;
  dailyStartTime: string;
  tripDates: string[];
  coverage: { min_total_visits: number } | null;
  validationErrors: string[];
}): AiPlannerPromptContext {
  return {
    trip: {
      destination: input.trip.destination,
      start_date: input.trip.start_date,
      end_date: input.trip.end_date,
    },
    preferences: input.preferences,
    lodging: input.lodging
      ? {
          name: input.lodging.name,
          latitude: input.lodging.latitude,
          longitude: input.lodging.longitude,
        }
      : null,
    daily_start_time: input.dailyStartTime,
    trip_start_point: transitPointPromptContext(input.arrivalPoint),
    trip_end_point: transitPointPromptContext(input.departurePoint),
    candidates: input.candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      category: candidate.category,
      tags: candidate.tags.filter(isAiInterestTag),
      area: candidate.area,
      region_distance_tier: candidate.region_distance_tier,
      typical_duration_minutes: candidate.typical_duration_minutes,
      planning_note: candidate.planning_note,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    })),
    tripDates: input.tripDates,
    coverage: input.coverage,
    validationErrors: input.validationErrors,
  };
}
