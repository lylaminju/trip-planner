import { isAiPlanningDestinationSupported } from "@/lib/ai-planning";
import type { AiPlanningSetup } from "@/lib/types";

import {
  getPlanningPreferences,
  getPrimaryLodging,
  listDestinationCandidates,
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
