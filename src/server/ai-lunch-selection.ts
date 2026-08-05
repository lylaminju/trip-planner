import { straightLineDistanceKm, type Coordinates } from "@/lib/geo-distance";
import type { AiDiningBudget } from "@/lib/types";
import { parseVisitTime } from "@/lib/visit-time";

import type {
  LunchOpeningPeriod,
  LunchRestaurantDetails,
} from "./google-places";
import {
  AI_LUNCH_MAX_DETOUR_KM,
  type AiPlanLunchCandidate,
  type AiPlanLunchSlot,
} from "./openai-ai-planner";

/**
 * The pure half of lunch selection: given what Google already returned for a
 * day's candidates, decide which one wins and what the resulting stop looks
 * like. Nothing here performs I/O or spends quota, so the gates and the
 * fallback ladder can be reasoned about and tested on their own.
 * `ai-lunch-enrichment` owns the Places calls that produce the input.
 */

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

export type LunchSelection = {
  stop: EnrichedLunchStop | null;
  chosenIndex: number | null;
  sourceIndex: number | null;
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

export function candidateGateResult(
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
export function selectLunch(
  slot: AiPlanLunchSlot,
  results: LunchCandidateResult[],
  fetched: Array<{ index: number; details: LunchRestaurantDetails }>,
  chosenIndex: number | null,
): LunchSelection {
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

export function unverifiedLunch(
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
