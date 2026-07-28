import { destinationCandidateKey } from "@/lib/ai-planning";
import type { AiPlanningSetup, Trip } from "@/lib/types";

import { transitPointOfKind } from "./ai-planning-transit-points";
import {
  getPlanningPreferences,
  getPrimaryLodging,
  getTransitPoints,
  listDestinationCandidates,
  listDestinationTransitHubs,
} from "./supabase-ai-planning-service";
import { requireTripRole } from "./trip-access";
import { getTripById } from "./trip-service";

export async function getAiPlanningSetupForRequest(
  tripId: number,
  userId: string,
): Promise<AiPlanningSetup> {
  await requireTripRole(tripId, userId, "owner");
  const trip = await getTripById(tripId);
  return loadAiPlanningSetupForTrip(trip);
}

// Setup loader for callers that have already authorized the request and hold
// the trip row; skips the second role check and trip query on the wizard path.
export async function loadAiPlanningSetupForTrip(
  trip: Trip,
): Promise<AiPlanningSetup> {
  const candidateKey = destinationCandidateKey(trip);

  if (!candidateKey) {
    return {
      trip,
      candidatesReady: false,
      candidates: [],
      lodging: null,
      arrivalPoint: null,
      departurePoint: null,
      transitHubs: [],
      preferences: null,
    };
  }

  const [candidates, lodging, transitPoints, transitHubs, preferences] =
    await Promise.all([
      listDestinationCandidates(candidateKey),
      getPrimaryLodging(trip.id),
      getTransitPoints(trip.id),
      listDestinationTransitHubs(candidateKey),
      getPlanningPreferences(trip.id),
    ]);

  return {
    trip,
    candidatesReady: candidates.length > 0,
    candidates,
    lodging,
    arrivalPoint: transitPointOfKind(transitPoints, "arrival"),
    departurePoint: transitPointOfKind(transitPoints, "departure"),
    transitHubs,
    preferences,
  };
}
