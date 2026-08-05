import { destinationCandidateKey } from "@/lib/ai-planning";
import type {
  AiDestinationCandidate,
  AiPlanningPreferences,
} from "@/lib/types";

import {
  parseAiPlanningPreferenceInput,
  withGuestPreferenceLimits,
} from "./ai-planning-preferences";
import {
  candidateIdSet,
  DESTINATION_NOT_PLANNABLE_MESSAGE,
} from "./ai-planning-shared";
import { TripValidationError } from "./errors";
import {
  listDestinationCandidates,
  upsertPlanningPreferences,
} from "./supabase-ai-planning-service";
import { requireTripRole } from "./trip-access";
import { getTripById } from "./trip-service";

export { getAiPlanningSetupForRequest } from "./ai-planning-setup";
export {
  prepareDestinationCatalogForRequest,
  prepareDestinationTransitHubsForRequest,
} from "./ai-planning-catalog-service";
export { generateAiItineraryForRequest } from "./ai-planning-generation-service";

// Lighter than the full planning setup: the Add Place search step only needs
// the destination's candidate catalog, not lodging/transit/preferences.
export async function listDestinationCandidatesForRequest(
  tripId: number,
  userId: string,
): Promise<AiDestinationCandidate[]> {
  await requireTripRole(tripId, userId, "owner");
  const trip = await getTripById(tripId);
  const candidateKey = destinationCandidateKey(trip);
  if (!candidateKey) {
    return [];
  }
  return listDestinationCandidates(candidateKey);
}

export async function saveAiPlanningPreferencesForRequest(
  tripId: number,
  userId: string,
  payload: unknown,
): Promise<AiPlanningPreferences> {
  await requireTripRole(tripId, userId, "owner");
  const trip = await getTripById(tripId);
  const candidateKey = destinationCandidateKey(trip);

  if (!candidateKey) {
    throw new TripValidationError(DESTINATION_NOT_PLANNABLE_MESSAGE);
  }

  const candidates = await listDestinationCandidates(candidateKey);
  const input = withGuestPreferenceLimits(
    parseAiPlanningPreferenceInput(payload, candidateIdSet(candidates)),
    userId,
  );

  return upsertPlanningPreferences(tripId, input);
}
