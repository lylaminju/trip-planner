import { GooglePlacesRateLimitError } from "@/server/errors";
import {
  fetchDestinationDetails,
  fetchDestinationSuggestions,
  requirePlacesApiKey,
  type DestinationDetails,
  type DestinationSuggestion,
} from "@/server/google-places";
import {
  countPlacesCallsThisMonth,
  countUserPlacesCallsToday,
  monthlyLimitForSku,
  PLACES_PER_USER_DAILY_LIMIT,
  PLACES_SKU,
  recordPlacesCall,
  type PlacesSku,
} from "@/server/supabase-google-places-usage-store";

// Below this length autocomplete predictions are too broad to be useful, so we
// skip the upstream call entirely and spend no budget on it.
export const MIN_DESTINATION_QUERY_LENGTH = 3;

export async function searchDestinations(
  userId: string,
  query: string,
  sessionToken: string,
): Promise<DestinationSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_DESTINATION_QUERY_LENGTH) {
    return [];
  }

  await assertPlacesBudget(userId, PLACES_SKU.AUTOCOMPLETE);

  const suggestions = await fetchDestinationSuggestions({
    apiKey: requirePlacesApiKey(),
    query: trimmed,
    sessionToken,
  });

  await recordPlacesCall(userId, PLACES_SKU.AUTOCOMPLETE);
  return suggestions;
}

export async function getDestinationDetails(
  userId: string,
  placeId: string,
  sessionToken: string,
): Promise<DestinationDetails> {
  await assertPlacesBudget(userId, PLACES_SKU.DETAILS);

  const details = await fetchDestinationDetails({
    apiKey: requirePlacesApiKey(),
    placeId,
    sessionToken,
  });

  await recordPlacesCall(userId, PLACES_SKU.DETAILS);
  return details;
}

async function assertPlacesBudget(
  userId: string,
  sku: PlacesSku,
): Promise<void> {
  const monthlyCount = await countPlacesCallsThisMonth(sku);
  if (monthlyCount >= monthlyLimitForSku(sku)) {
    throw new GooglePlacesRateLimitError(
      "Live destination search is paused until next month. Pick from the popular destinations instead.",
    );
  }

  const dailyCount = await countUserPlacesCallsToday(userId);
  if (dailyCount >= PLACES_PER_USER_DAILY_LIMIT) {
    throw new GooglePlacesRateLimitError(
      "You have reached today's destination search limit. Pick from the popular destinations instead.",
    );
  }
}
