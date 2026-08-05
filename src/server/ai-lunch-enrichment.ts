import {
  straightLineDistanceKm,
  type Coordinates,
} from "@/lib/geo-distance";
import type { AiDiningBudget } from "@/lib/types";
import { parseVisitTime } from "@/lib/visit-time";

import { GooglePlacesRateLimitError } from "./errors";
import {
  fetchLunchPlaceDetails,
  LUNCH_SEARCH_BIAS_RADIUS_METERS,
  requirePlacesApiKey,
  searchPlaceId,
  type LunchOpeningPeriod,
  type LunchRestaurantDetails,
} from "./google-places";
import { assertPlacesBudget } from "./google-places-search-service";
import {
  PLACES_SKU,
  recordPlacesCall,
} from "./supabase-google-places-usage-store";
import {
  AI_LUNCH_MAX_DETOUR_KM,
  type AiItineraryPlan,
  type AiPlanLunchCandidate,
  type AiPlanLunchSlot,
} from "./openai-ai-planner";

export const LUNCH_VERIFICATION_STATUS = {
  // Google confirmed the venue; canonical name/coords/link adopted.
  VERIFIED: "verified",
  // No Places data was obtained; the model's top pick stands as suggested.
  UNVERIFIED: "unverified",
  // Google knows the venue but it looks closed permanently or at lunch time.
  CLOSED_WARNING: "closed_warning",
} as const;

export type LunchVerificationStatus =
  (typeof LUNCH_VERIFICATION_STATUS)[keyof typeof LUNCH_VERIFICATION_STATUS];

// Per-candidate outcome taxonomy recorded in the verification log; keep values
// stable — they are the vocabulary of later log analysis.
export const LUNCH_CANDIDATE_RESULT = {
  CHOSEN: "chosen",
  NOT_FOUND: "not_found",
  NOT_OPERATIONAL: "not_operational",
  CLOSED_AT_LUNCH: "closed_at_lunch",
  BUDGET_MISMATCH: "budget_mismatch",
  DETAILS_ERROR: "details_error",
  // Resolved to a restaurant an earlier day already took.
  DUPLICATE: "duplicate",
  // Google placed it beyond the day's detour budget.
  TOO_FAR: "too_far",
  NOT_FETCHED: "not_fetched",
} as const;

export type LunchCandidateResult =
  (typeof LUNCH_CANDIDATE_RESULT)[keyof typeof LUNCH_CANDIDATE_RESULT];

export type EnrichedLunchStop = {
  name: string;
  latitude: number;
  longitude: number;
  start_time: string;
  duration_minutes: number;
  notes: string | null;
  google_place_id: string | null;
  google_maps_url: string | null;
  rating: number | null;
  user_rating_count: number | null;
  price_symbol: string | null;
  verification: LunchVerificationStatus;
};

// One entry per lunch day, persisted on the generation record so expand-the-
// candidate-cap decisions can be made from real outcome distributions.
export type LunchDayLog = {
  date: string;
  // null when the day ended up with no lunch stop at all, which happens when
  // every candidate repeated a restaurant an earlier day already took.
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

const GOOGLE_BUSINESS_STATUS_OPERATIONAL = "OPERATIONAL";

const PRICE_LEVEL_SYMBOLS: Record<string, string> = {
  PRICE_LEVEL_FREE: "$",
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

// Numeric tiers for the budget gate: a venue passes when its price level sits
// within one tier of the requested budget. Unknown price or no budget → pass.
const PRICE_LEVEL_TIERS: Record<string, number> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};
const DINING_BUDGET_TIERS: Record<AiDiningBudget, number> = {
  budget: 1,
  moderate: 2,
  upscale: 3,
};
const BUDGET_GATE_MAX_TIER_DISTANCE = 1;

const MINUTES_PER_DAY = 1_440;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

const UNVERIFIED_NOTE = "Couldn't verify this restaurant — check before going.";
const CLOSED_WARNING_NOTE =
  "May be closed at this time — check before going.";

/**
 * Selects and verifies each day's lunch venue: candidates are resolved to
 * place ids via the free IDs-only search, then Place Details Enterprise is
 * fetched in the model's rank order, stopping at the first candidate that
 * passes the hard gates (operational, open during the lunch window, price
 * within one tier of the requested budget, and not already taken by an earlier
 * day). Every failure mode degrades down the fallback ladder instead of failing
 * the generation, and each day's outcomes are returned as a log for later
 * analysis.
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
 * The no-Places variant used for guest generations: each day keeps the model's
 * top candidate with an unverified marker, no budget is spent, and no log is
 * produced (there are no verification outcomes to analyze). Without place ids
 * to compare, repeats are caught on the candidate name alone, so a day falls
 * through to its next candidate and is dropped when every name repeats.
 */
export function unverifiedLunchStops(
  plan: AiItineraryPlan,
): Map<string, EnrichedLunchStop> {
  const lunches = new Map<string, EnrichedLunchStop>();
  const usedNames = new Set<string>();
  for (const day of plan.days) {
    if (!day.lunch) continue;
    const candidate = day.lunch.candidates.find(
      (entry) => !usedNames.has(lunchNameKey(entry.name)),
    );
    if (!candidate) continue;
    usedNames.add(lunchNameKey(candidate.name));
    lunches.set(day.date, unverifiedLunch(day.lunch, candidate));
  }
  return lunches;
}

function lunchNameKey(name: string): string {
  return name.trim().toLowerCase();
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

function candidateGateResult(
  details: LunchRestaurantDetails,
  date: string,
  slot: AiPlanLunchSlot,
  diningBudget: AiDiningBudget | null,
  dayVisitCoordinates: readonly Coordinates[],
): LunchCandidateResult {
  if (
    details.business_status !== null &&
    details.business_status !== GOOGLE_BUSINESS_STATUS_OPERATIONAL
  ) {
    return LUNCH_CANDIDATE_RESULT.NOT_OPERATIONAL;
  }
  if (
    !isOpenDuring(
      details.open_periods,
      date,
      slot.start_time,
      slot.duration_minutes,
    )
  ) {
    return LUNCH_CANDIDATE_RESULT.CLOSED_AT_LUNCH;
  }
  if (isBeyondDetour(details, dayVisitCoordinates)) {
    return LUNCH_CANDIDATE_RESULT.TOO_FAR;
  }
  if (!budgetCompatible(diningBudget, details.price_level)) {
    return LUNCH_CANDIDATE_RESULT.BUDGET_MISMATCH;
  }
  return LUNCH_CANDIDATE_RESULT.CHOSEN;
}

// Judged on Google's coordinates rather than the model's claimed ones, since a
// venue only reaches here once Google has confirmed where it really is. A day
// with no visits to measure against never rejects.
function isBeyondDetour(
  details: LunchRestaurantDetails,
  dayVisitCoordinates: readonly Coordinates[],
): boolean {
  if (dayVisitCoordinates.length === 0) return false;
  const venue = {
    latitude: details.latitude,
    longitude: details.longitude,
  };
  return dayVisitCoordinates.every(
    (visit) => straightLineDistanceKm(venue, visit) > AI_LUNCH_MAX_DETOUR_KM,
  );
}

// Fallback ladder when no candidate passed every gate: a budget mismatch is
// still a real, open restaurant (its displayed price tells the story), a
// closed-looking venue keeps a warning, and with no Google data at all the
// model's top pick stands as unverified. Duplicates and too-far venues never
// win a rung: the budget and closed-looking rungs match only their own results,
// and the unverified fallback skips both explicitly. `sourceIndex`
// reports which candidate the stop came from even when `chosenIndex` is null,
// so the caller can claim the restaurant against later days.
function selectLunch(
  slot: AiPlanLunchSlot,
  results: LunchCandidateResult[],
  fetched: Array<{ index: number; details: LunchRestaurantDetails }>,
  chosenIndex: number | null,
): {
  stop: EnrichedLunchStop | null;
  chosenIndex: number | null;
  sourceIndex: number | null;
} {
  if (chosenIndex !== null) {
    const chosen = fetched.find((entry) => entry.index === chosenIndex);
    if (chosen) {
      return {
        stop: enrichedFromDetails(
          slot,
          slot.candidates[chosenIndex],
          chosen.details,
          LUNCH_VERIFICATION_STATUS.VERIFIED,
        ),
        chosenIndex,
        sourceIndex: chosenIndex,
      };
    }
  }

  const budgetMismatch = fetched.find(
    (entry) => results[entry.index] === LUNCH_CANDIDATE_RESULT.BUDGET_MISMATCH,
  );
  if (budgetMismatch) {
    return {
      stop: enrichedFromDetails(
        slot,
        slot.candidates[budgetMismatch.index],
        budgetMismatch.details,
        LUNCH_VERIFICATION_STATUS.VERIFIED,
      ),
      chosenIndex: budgetMismatch.index,
      sourceIndex: budgetMismatch.index,
    };
  }

  const closedLooking = fetched.find(
    (entry) =>
      results[entry.index] === LUNCH_CANDIDATE_RESULT.CLOSED_AT_LUNCH ||
      results[entry.index] === LUNCH_CANDIDATE_RESULT.NOT_OPERATIONAL,
  );
  if (closedLooking) {
    return {
      stop: enrichedFromDetails(
        slot,
        slot.candidates[closedLooking.index],
        closedLooking.details,
        LUNCH_VERIFICATION_STATUS.CLOSED_WARNING,
      ),
      chosenIndex: closedLooking.index,
      sourceIndex: closedLooking.index,
    };
  }

  // A day with no lunch is better than a repeat of yesterday's restaurant or a
  // detour across town, so when every candidate is one of those the slot is
  // dropped entirely.
  const fallbackIndex = results.findIndex(
    (result) =>
      result !== LUNCH_CANDIDATE_RESULT.DUPLICATE &&
      result !== LUNCH_CANDIDATE_RESULT.TOO_FAR,
  );
  if (fallbackIndex === -1) {
    return { stop: null, chosenIndex: null, sourceIndex: null };
  }

  return {
    stop: unverifiedLunch(slot, slot.candidates[fallbackIndex]),
    chosenIndex: null,
    sourceIndex: fallbackIndex,
  };
}

function budgetCompatible(
  diningBudget: AiDiningBudget | null,
  priceLevel: string | null,
): boolean {
  if (diningBudget === null || priceLevel === null) return true;
  const priceTier = PRICE_LEVEL_TIERS[priceLevel];
  if (priceTier === undefined) return true;
  return (
    Math.abs(priceTier - DINING_BUDGET_TIERS[diningBudget]) <=
    BUDGET_GATE_MAX_TIER_DISTANCE
  );
}

/**
 * Whether the whole lunch window fits inside one weekly opening period on the
 * visit's weekday. Unknown hours pass (no false closed warnings); a period
 * without a close means always open; periods crossing midnight are handled by
 * unwrapping the week.
 */
export function isOpenDuring(
  periods: LunchOpeningPeriod[] | null,
  date: string,
  startTime: string,
  durationMinutes: number,
): boolean {
  if (periods === null) return true;
  if (periods.some((period) => period.close_day === null)) return true;

  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const startMinute = parseVisitTime(startTime);
  if (Number.isNaN(weekday) || startMinute === null) return true;

  const lunchStart = weekday * MINUTES_PER_DAY + startMinute;
  const lunchEnd = lunchStart + durationMinutes;

  return periods.some((period) => {
    if (period.close_day === null || period.close_minute === null) return true;
    const openAt = period.open_day * MINUTES_PER_DAY + period.open_minute;
    let closeAt = period.close_day * MINUTES_PER_DAY + period.close_minute;
    if (closeAt <= openAt) {
      closeAt += MINUTES_PER_WEEK;
    }
    return (
      containsInterval(openAt, closeAt, lunchStart, lunchEnd) ||
      containsInterval(
        openAt,
        closeAt,
        lunchStart + MINUTES_PER_WEEK,
        lunchEnd + MINUTES_PER_WEEK,
      )
    );
  });
}

function containsInterval(
  openAt: number,
  closeAt: number,
  start: number,
  end: number,
): boolean {
  return openAt <= start && end <= closeAt;
}

function enrichedFromDetails(
  slot: AiPlanLunchSlot,
  candidate: AiPlanLunchCandidate,
  details: LunchRestaurantDetails,
  verification: LunchVerificationStatus,
): EnrichedLunchStop {
  return {
    // Google's record is canonical once matched: exact name, precise
    // coordinates, and a stable Maps link.
    name: details.name,
    latitude: details.latitude,
    longitude: details.longitude,
    start_time: slot.start_time,
    duration_minutes: slot.duration_minutes,
    notes: candidate.notes,
    google_place_id: details.place_id,
    google_maps_url: details.google_maps_url,
    rating: details.rating,
    user_rating_count: details.user_rating_count,
    price_symbol: details.price_level
      ? (PRICE_LEVEL_SYMBOLS[details.price_level] ?? null)
      : null,
    verification,
  };
}

function unverifiedLunch(
  slot: AiPlanLunchSlot,
  candidate: AiPlanLunchCandidate,
): EnrichedLunchStop {
  return {
    name: candidate.name,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    start_time: slot.start_time,
    duration_minutes: slot.duration_minutes,
    notes: candidate.notes,
    google_place_id: null,
    google_maps_url: null,
    rating: null,
    user_rating_count: null,
    price_symbol: null,
    verification: LUNCH_VERIFICATION_STATUS.UNVERIFIED,
  };
}
