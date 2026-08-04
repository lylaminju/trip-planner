import { GooglePlacesRateLimitError } from "./errors";
import {
  fetchLunchRestaurantDetails,
  requirePlacesApiKey,
  type LunchRestaurantDetails,
} from "./google-places";
import { assertPlacesBudget } from "./google-places-search-service";
import {
  PLACES_SKU,
  recordPlacesCall,
} from "./supabase-google-places-usage-store";
import type { AiItineraryPlan, AiPlanLunchStop } from "./openai-ai-planner";

export const LUNCH_VERIFICATION_STATUS = {
  // Google confirmed the restaurant; canonical name/coords/link adopted.
  VERIFIED: "verified",
  // No Places lookup happened or it found nothing; the model's data stands.
  UNVERIFIED: "unverified",
  // Google knows the place but it looks closed permanently or on that weekday.
  CLOSED_WARNING: "closed_warning",
} as const;

export type LunchVerificationStatus =
  (typeof LUNCH_VERIFICATION_STATUS)[keyof typeof LUNCH_VERIFICATION_STATUS];

export type EnrichedLunchStop = AiPlanLunchStop & {
  google_place_id: string | null;
  google_maps_url: string | null;
  rating: number | null;
  user_rating_count: number | null;
  price_symbol: string | null;
  verification: LunchVerificationStatus;
};

const GOOGLE_BUSINESS_STATUS_OPERATIONAL = "OPERATIONAL";

const PRICE_LEVEL_SYMBOLS: Record<string, string> = {
  PRICE_LEVEL_FREE: "$",
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

const UNVERIFIED_NOTE = "Couldn't verify this restaurant — check before going.";
const CLOSED_WARNING_NOTE =
  "May be closed on this day — check before going.";

/**
 * Verifies each AI-suggested lunch stop against Google Places (one Text Search
 * per lunch, the run's only Places spend) and returns the enriched stops keyed
 * by trip date. Every failure mode — exhausted budget, upstream error, no
 * match — degrades that lunch to "unverified" instead of failing the
 * generation.
 */
export async function enrichLunchStops(input: {
  plan: AiItineraryPlan;
  destination: string;
  userId: string;
}): Promise<Map<string, EnrichedLunchStop>> {
  const enriched = new Map<string, EnrichedLunchStop>();
  // Once the shared budget is exhausted, skip the remaining lookups instead of
  // asserting per day just to collect the same rejection.
  let budgetExhausted = false;

  for (const day of input.plan.days) {
    if (!day.lunch) continue;
    if (budgetExhausted) {
      enriched.set(day.date, unverifiedLunch(day.lunch));
      continue;
    }

    try {
      await assertPlacesBudget(input.userId, PLACES_SKU.LUNCH_SEARCH);
    } catch (error) {
      if (error instanceof GooglePlacesRateLimitError) {
        budgetExhausted = true;
      }
      enriched.set(day.date, unverifiedLunch(day.lunch));
      continue;
    }

    try {
      const details = await fetchLunchRestaurantDetails({
        apiKey: requirePlacesApiKey(),
        query: `${day.lunch.name}, ${input.destination}`,
        locationBias: {
          latitude: day.lunch.latitude,
          longitude: day.lunch.longitude,
        },
      });
      await recordPlacesCall(input.userId, PLACES_SKU.LUNCH_SEARCH);
      enriched.set(
        day.date,
        details
          ? enrichedFromDetails(day.lunch, day.date, details)
          : unverifiedLunch(day.lunch),
      );
    } catch {
      enriched.set(day.date, unverifiedLunch(day.lunch));
    }
  }

  return enriched;
}

/**
 * The no-Places variant used for guest generations: every lunch keeps the
 * model's data and an unverified marker, and no budget is spent.
 */
export function unverifiedLunchStops(
  plan: AiItineraryPlan,
): Map<string, EnrichedLunchStop> {
  const lunches = new Map<string, EnrichedLunchStop>();
  for (const day of plan.days) {
    if (day.lunch) {
      lunches.set(day.date, unverifiedLunch(day.lunch));
    }
  }
  return lunches;
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

function enrichedFromDetails(
  lunch: AiPlanLunchStop,
  date: string,
  details: LunchRestaurantDetails,
): EnrichedLunchStop {
  const looksClosed =
    (details.business_status !== null &&
      details.business_status !== GOOGLE_BUSINESS_STATUS_OPERATIONAL) ||
    isClosedOnDate(details.open_weekdays, date);

  return {
    ...lunch,
    // Google's record is canonical once matched: exact name, precise
    // coordinates, and a stable Maps link.
    name: details.name,
    latitude: details.latitude,
    longitude: details.longitude,
    google_place_id: details.place_id,
    google_maps_url: details.google_maps_url,
    rating: details.rating,
    user_rating_count: details.user_rating_count,
    price_symbol: details.price_level
      ? (PRICE_LEVEL_SYMBOLS[details.price_level] ?? null)
      : null,
    verification: looksClosed
      ? LUNCH_VERIFICATION_STATUS.CLOSED_WARNING
      : LUNCH_VERIFICATION_STATUS.VERIFIED,
  };
}

function isClosedOnDate(
  openWeekdays: number[] | null,
  date: string,
): boolean {
  if (openWeekdays === null) return false;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return Number.isNaN(weekday) ? false : !openWeekdays.includes(weekday);
}

function unverifiedLunch(lunch: AiPlanLunchStop): EnrichedLunchStop {
  return {
    ...lunch,
    google_place_id: null,
    google_maps_url: null,
    rating: null,
    user_rating_count: null,
    price_symbol: null,
    verification: LUNCH_VERIFICATION_STATUS.UNVERIFIED,
  };
}
