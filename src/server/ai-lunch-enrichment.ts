import type { Coordinates } from "@/lib/geo-distance";
import type { AiDiningBudget } from "@/lib/types";

import {
  candidateGateResult,
  LUNCH_CANDIDATE_RESULT,
  LUNCH_VERIFICATION_STATUS,
  selectLunch,
  type EnrichedLunchStop,
  type LunchCandidateResult,
  type LunchVerificationStatus,
} from "./ai-lunch-selection";
import { GooglePlacesRateLimitError } from "./errors";
import {
  fetchLunchPlaceDetails,
  LUNCH_SEARCH_BIAS_RADIUS_METERS,
  requirePlacesApiKey,
  searchPlaceId,
  type LunchRestaurantDetails,
} from "./google-places";
import { assertPlacesBudget } from "./google-places-search-service";
import {
  PLACES_SKU,
  recordPlacesCall,
} from "./supabase-google-places-usage-store";
import type {
  AiItineraryPlan,
  AiPlanLunchCandidate,
} from "./openai-ai-planner";

// The lunch feature's entry point, so consumers keep importing its vocabulary
// from here even though `ai-lunch-selection` owns the pure decision logic.
export {
  isOpenDuring,
  LUNCH_CANDIDATE_RESULT,
  LUNCH_VERIFICATION_STATUS,
  type EnrichedLunchStop,
  type LunchCandidateResult,
  type LunchVerificationStatus,
} from "./ai-lunch-selection";

// One entry per lunch day, persisted on the generation record so expand-the-
// candidate-cap decisions can be made from real outcome distributions.
export type LunchDayLog = {
  date: string;
  // null when the day ended up with no lunch stop at all, which happens when
  // every candidate repeated a restaurant an earlier day already took or sat
  // beyond the day's detour budget.
  outcome: LunchVerificationStatus | null;
  // Index into candidates of the venue that ended up in the itinerary; null
  // when the day fell back to unverified model data.
  chosen_index: number | null;
  details_calls: number;
  candidates: Array<{ name: string; result: LunchCandidateResult }>;
};

export type LunchEnrichmentResult = {
  lunchByDate: Map<string, EnrichedLunchStop>;
  log: LunchDayLog[];
};

const UNVERIFIED_NOTE = "Couldn't verify this restaurant — check before going.";
const CLOSED_WARNING_NOTE =
  "May be closed at this time — check before going.";

/**
 * Selects and verifies each day's lunch venue: candidates are resolved to
 * place ids via the free IDs-only search, then Place Details Enterprise is
 * fetched in the model's rank order, stopping at the first candidate that
 * passes the hard gates (operational, open during the lunch window, price
 * within one tier of the requested budget, near the day's attractions, and not
 * already taken by an earlier day). Every failure mode degrades down the
 * fallback ladder instead of failing the generation, and each day's outcomes
 * are returned as a log for later analysis.
 */
export async function enrichLunchStops(input: {
  plan: AiItineraryPlan;
  destination: string;
  userId: string;
  diningBudget: AiDiningBudget | null;
  // Catalog places already scheduled as visits. Some catalogs list cafes as
  // attractions, so without these a lunch pick can land on a venue the trip
  // already visits: the same repeat the attraction rules forbid, arriving
  // through the lunch field instead.
  scheduledPlaceIds?: ReadonlySet<string>;
  // Where each day's attractions actually are, keyed by date. The model reasons
  // about distance from memory and gets it wrong, so this is what stops a venue
  // across town from being scheduled between two downtown stops.
  visitCoordinatesByDate?: ReadonlyMap<string, readonly Coordinates[]>;
}): Promise<LunchEnrichmentResult> {
  const lunchByDate = new Map<string, EnrichedLunchStop>();
  const log: LunchDayLog[] = [];
  // Restaurants the trip has already taken, seeded with the scheduled visits.
  // The prompt tells the model not to reuse a venue, but two different
  // candidate names can still resolve to one real restaurant, so the resolved
  // place id is the only trustworthy identity to dedup on.
  const usedPlaceIds = new Set<string>(input.scheduledPlaceIds ?? []);
  // Once the shared budget is exhausted, skip the remaining lookups instead of
  // asserting per candidate just to collect the same rejection.
  let budgetExhausted = false;

  for (const day of input.plan.days) {
    const lunch = day.lunch;
    if (!lunch || lunch.candidates.length === 0) continue;

    const results: LunchCandidateResult[] = lunch.candidates.map(
      () => LUNCH_CANDIDATE_RESULT.NOT_FETCHED,
    );
    const resolvedPlaceIds: Array<string | null> = lunch.candidates.map(
      () => null,
    );
    const fetched: Array<{ index: number; details: LunchRestaurantDetails }> =
      [];
    let detailsCalls = 0;
    let chosenIndex: number | null = null;

    for (let index = 0; index < lunch.candidates.length; index += 1) {
      const candidate = lunch.candidates[index];

      const placeId = await resolveCandidatePlaceId(
        candidate,
        input.destination,
      );
      if (placeId === null) {
        results[index] = LUNCH_CANDIDATE_RESULT.NOT_FOUND;
        continue;
      }
      resolvedPlaceIds[index] = placeId;
      // Rejecting a repeat here, before the details fetch, also keeps a
      // duplicate from spending Place Details Enterprise quota.
      if (usedPlaceIds.has(placeId)) {
        results[index] = LUNCH_CANDIDATE_RESULT.DUPLICATE;
        continue;
      }

      if (budgetExhausted) break;
      try {
        await assertPlacesBudget(
          input.userId,
          PLACES_SKU.PLACE_DETAILS_ENTERPRISE,
        );
      } catch (error) {
        if (error instanceof GooglePlacesRateLimitError) {
          budgetExhausted = true;
        }
        console.warn("AI lunch verification skipped: budget check failed", {
          date: day.date,
          error,
        });
        break;
      }

      let details: LunchRestaurantDetails | null = null;
      try {
        details = await fetchLunchPlaceDetails({
          apiKey: requirePlacesApiKey(),
          placeId,
        });
        detailsCalls += 1;
        // A metering failure must not discard a verification Google already
        // answered; log and keep the result, like Routes usage recording does.
        try {
          await recordPlacesCall(
            input.userId,
            PLACES_SKU.PLACE_DETAILS_ENTERPRISE,
          );
        } catch (error) {
          console.warn(
            "Failed to record Places place_details_enterprise usage",
            error,
          );
        }
      } catch (error) {
        console.warn("AI lunch verification failed", {
          date: day.date,
          lunchName: candidate.name,
          error,
        });
        results[index] = LUNCH_CANDIDATE_RESULT.DETAILS_ERROR;
        continue;
      }
      if (details === null) {
        results[index] = LUNCH_CANDIDATE_RESULT.NOT_FOUND;
        continue;
      }

      fetched.push({ index, details });
      const gateResult = candidateGateResult(
        details,
        day.date,
        lunch,
        input.diningBudget,
        input.visitCoordinatesByDate?.get(day.date) ?? [],
      );
      results[index] = gateResult;
      if (gateResult === LUNCH_CANDIDATE_RESULT.CHOSEN) {
        chosenIndex = index;
        break;
      }
    }

    const selection = selectLunch(lunch, results, fetched, chosenIndex);
    if (selection.stop !== null) {
      lunchByDate.set(day.date, selection.stop);
      // Verified stops carry Google's own id; an unverified fallback still has
      // a resolved id whenever the search matched, and claiming it here stops a
      // later day from scheduling the same restaurant.
      const takenPlaceId =
        selection.stop.google_place_id ??
        (selection.sourceIndex === null
          ? null
          : resolvedPlaceIds[selection.sourceIndex]);
      if (takenPlaceId !== null) {
        usedPlaceIds.add(takenPlaceId);
      }
    }
    log.push({
      date: day.date,
      outcome: selection.stop?.verification ?? null,
      chosen_index: selection.chosenIndex,
      details_calls: detailsCalls,
      candidates: lunch.candidates.map((candidate, index) => ({
        name: candidate.name,
        result: results[index],
      })),
    });
  }

  return { lunchByDate, log };
}

/**
 * The place/schedule note for a lunch stop: Google's rating and price tier
 * when verified, then the model's own note, then any verification warning.
 */
export function lunchDisplayNotes(lunch: EnrichedLunchStop): string | null {
  const meta: string[] = [];
  if (lunch.rating !== null) {
    meta.push(
      lunch.user_rating_count !== null
        ? `★ ${lunch.rating} (${lunch.user_rating_count.toLocaleString("en-US")} reviews)`
        : `★ ${lunch.rating}`,
    );
  }
  if (lunch.price_symbol) {
    meta.push(lunch.price_symbol);
  }

  const warning =
    lunch.verification === LUNCH_VERIFICATION_STATUS.UNVERIFIED
      ? UNVERIFIED_NOTE
      : lunch.verification === LUNCH_VERIFICATION_STATUS.CLOSED_WARNING
        ? CLOSED_WARNING_NOTE
        : null;

  const combined = [meta.join(" · "), lunch.notes, warning]
    .filter((part) => part && part.trim() !== "")
    .join(" — ");
  return combined === "" ? null : combined;
}

async function resolveCandidatePlaceId(
  candidate: AiPlanLunchCandidate,
  destination: string,
): Promise<string | null> {
  try {
    return await searchPlaceId({
      apiKey: requirePlacesApiKey(),
      query: `${candidate.name}, ${destination}`,
      locationBias: {
        latitude: candidate.latitude,
        longitude: candidate.longitude,
      },
      biasRadiusMeters: LUNCH_SEARCH_BIAS_RADIUS_METERS,
    });
  } catch (error) {
    console.warn("AI lunch candidate resolution failed", {
      lunchName: candidate.name,
      error,
    });
    return null;
  }
}
