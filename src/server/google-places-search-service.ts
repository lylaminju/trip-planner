import { GooglePlacesRateLimitError } from "@/server/errors";
import {
  fetchDestinationDetails,
  fetchDestinationSuggestions,
  fetchPlaceNameAndPhotoReference,
  fetchPlacePhoto,
  requirePlacesApiKey,
  type AutocompleteLocationBias,
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

// A cover-sized preview is plenty for the trip card; the same bytes are reused
// as the stored cover, so there is never a second, larger fetch. Capping height
// too keeps tall/portrait sources from downloading oversized only to be cropped
// away by the landscape covers.
const PHOTO_PREVIEW_MAX_WIDTH_PX = 800;
const PHOTO_PREVIEW_MAX_HEIGHT_PX = 800;

// Fail closed on anything that is not a Place Photo resource name, so a
// request-supplied value can never drive an arbitrary upstream fetch.
const PHOTO_NAME_PATTERN = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

export function isValidPlacePhotoName(photoName: string): boolean {
  return PHOTO_NAME_PATTERN.test(photoName);
}

export async function searchDestinations(
  userId: string,
  query: string,
  sessionToken: string,
  locationBias: AutocompleteLocationBias | null = null,
  countryCodes: string[] | null = null,
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
    locationBias,
    countryCodes,
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

/**
 * Fetches a place photo once (the single billed call) and returns it as a data
 * URL. The browser previews this image and hands the same bytes back at trip
 * creation, so a created trip's cover is never fetched from Google twice.
 */
export async function getDestinationPhoto(
  userId: string,
  photoName: string,
): Promise<string> {
  await assertPlacesBudget(userId, PLACES_SKU.PHOTO);

  const photo = await fetchPlacePhoto({
    apiKey: requirePlacesApiKey(),
    photoName,
    maxWidthPx: PHOTO_PREVIEW_MAX_WIDTH_PX,
    maxHeightPx: PHOTO_PREVIEW_MAX_HEIGHT_PX,
  });
  await recordPlacesCall(userId, PLACES_SKU.PHOTO);

  const base64 = Buffer.from(photo.bytes).toString("base64");
  return `data:${photo.contentType};base64,${base64}`;
}

export type PlaceNameAndPhotoResult = {
  name: string | null;
  data_url: string | null;
  attribution: string | null;
};

/**
 * Resolves the display name and photo for a place picked without a details call
 * (a map POI click). The name only exists in Place Details Pro, so unlike the
 * old IDs-Only reference lookup this call is billed and is therefore gated and
 * recorded under the details SKU. The photo reference rides along in the same
 * field mask, so it costs nothing beyond the name.
 *
 * Callers reaching a budget ceiling get a GooglePlacesRateLimitError and fall
 * back to the free behaviour: the user types the name in the modal.
 *
 * `skipPhoto` is for places we already hold an image for: the name still needs
 * this lookup, but the Place Photo call on top of it would buy nothing.
 */
export async function getPlaceNameAndPhoto(
  userId: string,
  placeId: string,
  options: { skipPhoto?: boolean } = {},
): Promise<PlaceNameAndPhotoResult> {
  await assertPlacesBudget(userId, PLACES_SKU.DETAILS);

  const reference = await fetchPlaceNameAndPhotoReference({
    apiKey: requirePlacesApiKey(),
    placeId,
  });
  await recordPlacesCall(userId, PLACES_SKU.DETAILS);

  if (options.skipPhoto || !reference.photo_name) {
    return { name: reference.name, data_url: null, attribution: null };
  }

  return {
    name: reference.name,
    data_url: await getDestinationPhoto(userId, reference.photo_name),
    attribution: reference.photo_attribution,
  };
}

export async function assertPlacesBudget(
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
