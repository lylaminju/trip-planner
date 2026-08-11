import { straightLineDistanceKm } from "@/lib/geo-distance";
import type { AiDestinationCandidate } from "@/lib/types";

import { fetchCandidatePlace, searchPlaceId } from "./google-places";
import type { CandidatePlace } from "./google-places";
import {
  MIN_NAME_MATCH_SCORE,
  nameMatchScore,
  sharesDistinctiveToken,
} from "./place-name-match";
import {
  PLACES_SKU,
  recordPlacesCall,
} from "./supabase-google-places-usage-store";

// A resolved place farther than this from the candidate's generated point is
// treated as a different place. Wide because that point is a model estimate
// that can miss by kilometres, and because Google's marker for a large natural
// feature sits far from any centroid. Wrong-place homonyms are rejected by the
// name guards, not by this cap.
export const CANDIDATE_MATCH_MAX_DISTANCE_KM = 15;

export type CandidatePlaceRejection = "name" | "distance" | "duplicate";

export type CandidatePlaceResolution = {
  place: CandidatePlace;
  rejection: CandidatePlaceRejection | null;
};

/**
 * Why a resolved place must not be written onto a candidate, or null when it
 * is safe to trust. Pure, so the rules stay testable without a Places call.
 *
 * The duplicate check runs first: a place another candidate in the same
 * catalog already holds is rejected however well it matches, because the model
 * pads a catalog toward its target count by re-describing places it has
 * already listed, and one stop must not enter a catalog twice.
 */
export function candidatePlaceRejection(input: {
  candidate: Pick<AiDestinationCandidate, "name" | "latitude" | "longitude">;
  destinationName: string;
  place: CandidatePlace;
  placeIdsInUse: ReadonlySet<string>;
}): CandidatePlaceRejection | null {
  const { candidate, place } = input;

  if (input.placeIdsInUse.has(place.place_id)) {
    return "duplicate";
  }
  if (nameMatchScore(candidate.name, place.name) < MIN_NAME_MATCH_SCORE) {
    return "name";
  }
  if (!sharesDistinctiveToken(candidate.name, place.name, input.destinationName)) {
    return "name";
  }
  if (
    straightLineDistanceKm(candidate, place) > CANDIDATE_MATCH_MAX_DISTANCE_KM
  ) {
    return "distance";
  }
  return null;
}

/**
 * Resolves one catalog candidate to a real Google place: a $0 IDs-Only text
 * search anchored on the destination, then one Place Details Pro lookup for
 * the name, location, and photo reference. Returns the place with the reason
 * it must not be trusted, or null when nothing resolved.
 *
 * The Details call is billed and recorded whether or not the match is
 * accepted — the request happened either way.
 */
export async function resolveCandidatePlace(input: {
  apiKey: string;
  userId: string;
  candidate: Pick<AiDestinationCandidate, "name" | "latitude" | "longitude">;
  destinationName: string;
  destinationLocation: { latitude: number; longitude: number } | null;
  placeIdsInUse: ReadonlySet<string>;
}): Promise<CandidatePlaceResolution | null> {
  const placeId = await searchPlaceId({
    apiKey: input.apiKey,
    query: `${input.candidate.name}, ${input.destinationName}`,
    locationBias: input.destinationLocation,
  });
  if (!placeId) return null;

  const place = await fetchCandidatePlace({ apiKey: input.apiKey, placeId });
  await recordPlacesCall(input.userId, PLACES_SKU.DETAILS);
  if (!place) return null;

  return {
    place,
    rejection: candidatePlaceRejection({
      candidate: input.candidate,
      destinationName: input.destinationName,
      place,
      placeIdsInUse: input.placeIdsInUse,
    }),
  };
}
