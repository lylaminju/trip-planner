import { isAiPlanningDestinationSupported } from "@/lib/ai-planning";
import type {
  AiDestinationCandidate,
  AiPlanningPreferences,
  AiPlanningSetup,
} from "@/lib/types";

import { parseAiPlanningPreferenceInput } from "./ai-planning-preferences";
import { TripValidationError } from "./errors";
import {
  getPlanningPreferences,
  getPrimaryLodging,
  listDestinationCandidates,
  upsertPlanningPreferences,
} from "./supabase-ai-planning-service";
import { requireTripRole } from "./trip-access";
import { getTripById } from "./trip-service";

export async function getAiPlanningSetupForRequest(
  tripId: number,
  userId: string,
): Promise<AiPlanningSetup> {
  await requireTripRole(tripId, userId, "owner");
  const trip = await getTripById(tripId);
  const isSupportedDestination = isAiPlanningDestinationSupported(
    trip.destination_slug,
  );

  if (!isSupportedDestination || !trip.destination_slug) {
    return {
      trip,
      isSupportedDestination: false,
      candidates: [],
      lodging: null,
      preferences: null,
    };
  }

  const [candidates, lodging, preferences] = await Promise.all([
    listDestinationCandidates(trip.destination_slug),
    getPrimaryLodging(tripId),
    getPlanningPreferences(tripId),
  ]);

  return {
    trip,
    isSupportedDestination,
    candidates,
    lodging,
    preferences,
  };
}

export async function saveAiPlanningPreferencesForRequest(
  tripId: number,
  userId: string,
  payload: unknown,
): Promise<AiPlanningPreferences> {
  await requireTripRole(tripId, userId, "owner");
  const trip = await getTripById(tripId);

  if (
    !trip.destination_slug ||
    !isAiPlanningDestinationSupported(trip.destination_slug)
  ) {
    throw new TripValidationError(
      "AI planning is not available for this destination.",
    );
  }

  const candidates = await listDestinationCandidates(trip.destination_slug);
  const input = parseAiPlanningPreferenceInput(
    payload,
    candidateIdSet(candidates),
  );

  return upsertPlanningPreferences(tripId, input);
}

function candidateIdSet(
  candidates: AiDestinationCandidate[],
): ReadonlySet<number> {
  return new Set(candidates.map((candidate) => candidate.id));
}
