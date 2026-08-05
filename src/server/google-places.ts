import {
  GooglePlacesConfigError,
  GooglePlacesUpstreamError,
} from "@/server/errors";

export type DestinationSuggestion = {
  place_id: string;
  primary_text: string;
  secondary_text: string | null;
};

export type AutocompleteLocationBias = {
  latitude: number;
  longitude: number;
};

export type DestinationDetails = {
  place_id: string;
  name: string;
  latitude: number;
  longitude: number;
  google_maps_url: string | null;
  // CLDR/ISO region code of the place's country (e.g. "JP"), used to restrict a
  // trip's later place searches to the destination country. Null when Google
  // returns no country component.
  country_code: string | null;
  // Photo resource name (e.g. "places/ID/photos/REF") and its required author
  // attribution. The actual image is only fetched later, once per created trip.
  photo_name: string | null;
  photo_attribution: string | null;
};

const AUTOCOMPLETE_ENDPOINT =
  "https://places.googleapis.com/v1/places:autocomplete";
const SEARCH_TEXT_ENDPOINT =
  "https://places.googleapis.com/v1/places:searchText";
const DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places";
const PLACES_MEDIA_BASE = "https://places.googleapis.com/v1";
const REQUEST_TIMEOUT_MS = 8_000;

// Largest circle radius the Places autocomplete locationBias accepts. We bias
// (not restrict) to the trip destination, so distant explicit queries still match.
const AUTOCOMPLETE_BIAS_RADIUS_METERS = 50_000;

// Google's includedRegionCodes accepts at most 15 CLDR region codes (identical
// to ISO-3166 alpha-2 country codes for our use); extra codes are rejected by the
// API, so we cap before sending.
const AUTOCOMPLETE_MAX_COUNTRY_CODES = 15;

const AUTOCOMPLETE_FIELD_MASK =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat";
// Keep the details field mask inside Place Details Pro so a lookup never
// escalates into the pricier Enterprise/Atmosphere tiers. `photos` is an
// Essentials IDs-Only field, so it returns the photo reference for free without
// bumping the tier — the image itself is a separate Place Photo request.
// `addressComponents` stays within Pro too, and supplies the country code for
// free from the same billed lookup.
const DETAILS_FIELD_MASK =
  "id,displayName,location,googleMapsUri,photos,addressComponents";
// Every field here is Essentials IDs-Only, so this lookup is free. It exists to
// resolve a photo reference for places picked without a details call (map POIs).
const PHOTO_REFERENCE_FIELD_MASK = "id,photos";
// `displayName` is a Place Details Pro field, so this lookup IS billed, unlike
// the IDs-Only mask above. `id` and `photos` ride along for free because a
// field mask bills at its highest tier — one Pro call yields both the name and
// the photo reference, instead of a free lookup plus a separate Pro one.
const NAME_AND_PHOTO_FIELD_MASK = "id,displayName,photos";
// Text Search masked to the place id alone stays in the free IDs-Only SKU;
// any richer field would escalate the whole request to a billed tier.
const SEARCH_TEXT_FIELD_MASK = "places.id";
// Same soft-bias contract as autocomplete: rank results near the destination
// first without excluding an exact-name match elsewhere.
const SEARCH_TEXT_BIAS_RADIUS_METERS = 50_000;
// AI lunch selection needs rating, price level, and the weekly schedule, which
// are Place Details Enterprise fields (1,000 free calls/month, and cheaper
// than Text Search Enterprise because the free IDs-only search resolves the
// place id first). This mask must never grow an Enterprise + Atmosphere field
// (reviews, servesXxx, editorialSummary, ...): that escalates every lookup to
// the most expensive Places SKU. regularOpeningHours (the weekly schedule) is
// chosen over currentOpeningHours because trips are planned for future dates.
const LUNCH_DETAILS_FIELD_MASK =
  "id,displayName,location,businessStatus,googleMapsUri,rating,userRatingCount,priceLevel,regularOpeningHours";
// Lunch candidates are resolved where the model placed them, so the bias
// circle is much tighter than destination-wide search: it keeps a common
// restaurant name from matching a same-name place across town.
export const LUNCH_SEARCH_BIAS_RADIUS_METERS = 5_000;

export function requirePlacesApiKey(): string {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    throw new GooglePlacesConfigError("Google Places API key is not configured.");
  }
  return apiKey;
}

export async function fetchDestinationSuggestions(input: {
  apiKey: string;
  query: string;
  sessionToken: string;
  locationBias?: AutocompleteLocationBias | null;
  // Restrict predictions to these countries. Used to keep a trip's place search
  // inside its destination country. Empty/absent = no restriction. The soft
  // locationBias still ranks nearby results first within.
  countryCodes?: string[] | null;
}): Promise<DestinationSuggestion[]> {
  const countryCodes = (input.countryCodes ?? [])
    .map((code) => code.toLowerCase())
    .slice(0, AUTOCOMPLETE_MAX_COUNTRY_CODES);

  const payload = await placesFetch({
    url: AUTOCOMPLETE_ENDPOINT,
    apiKey: input.apiKey,
    fieldMask: AUTOCOMPLETE_FIELD_MASK,
    method: "POST",
    body: {
      input: input.query,
      sessionToken: input.sessionToken,
      ...(input.locationBias
        ? {
            locationBias: {
              circle: {
                center: {
                  latitude: input.locationBias.latitude,
                  longitude: input.locationBias.longitude,
                },
                radius: AUTOCOMPLETE_BIAS_RADIUS_METERS,
              },
            },
          }
        : {}),
      // `includedRegionCodes` is Google's parameter name; for our purposes the
      // values are the destination country codes.
      ...(countryCodes.length ? { includedRegionCodes: countryCodes } : {}),
    },
  });

  return parseSuggestions(payload);
}

export async function fetchDestinationDetails(input: {
  apiKey: string;
  placeId: string;
  sessionToken: string;
}): Promise<DestinationDetails> {
  const url = `${DETAILS_ENDPOINT}/${encodeURIComponent(
    input.placeId,
  )}?sessionToken=${encodeURIComponent(input.sessionToken)}`;

  const payload = await placesFetch({
    url,
    apiKey: input.apiKey,
    fieldMask: DETAILS_FIELD_MASK,
    method: "GET",
  });

  const details = parseDetails(payload);
  if (!details) {
    throw new GooglePlacesUpstreamError(
      "Google Places API returned an unusable place.",
      502,
    );
  }
  return details;
}

/**
 * Resolves a free-text place name to its place id via Text Search with an
 * IDs-Only field mask (a $0 SKU). Returns null when nothing matches.
 */
export async function searchPlaceId(input: {
  apiKey: string;
  query: string;
  locationBias?: AutocompleteLocationBias | null;
  biasRadiusMeters?: number;
}): Promise<string | null> {
  const payload = await placesFetch({
    url: SEARCH_TEXT_ENDPOINT,
    apiKey: input.apiKey,
    fieldMask: SEARCH_TEXT_FIELD_MASK,
    method: "POST",
    body: {
      textQuery: input.query,
      ...(input.locationBias
        ? {
            locationBias: {
              circle: {
                center: {
                  latitude: input.locationBias.latitude,
                  longitude: input.locationBias.longitude,
                },
                radius: input.biasRadiusMeters ?? SEARCH_TEXT_BIAS_RADIUS_METERS,
              },
            },
          }
        : {}),
    },
  });

  return parseFirstSearchPlaceId(payload);
}

export function parseFirstSearchPlaceId(payload: unknown): string | null {
  const places = asRecord(payload).places;
  if (!Array.isArray(places)) {
    return null;
  }
  return asString(asRecord(places[0]).id);
}

// One weekly opening interval. Days are Google's (and JS getUTCDay's)
// convention: 0 = Sunday. A null close marks an always-open place.
export type LunchOpeningPeriod = {
  open_day: number;
  open_minute: number;
  close_day: number | null;
  close_minute: number | null;
};

export type LunchRestaurantDetails = {
  place_id: string;
  name: string;
  latitude: number;
  longitude: number;
  google_maps_url: string | null;
  // Google businessStatus, e.g. "OPERATIONAL" / "CLOSED_PERMANENTLY"; null
  // when the field is absent from the response.
  business_status: string | null;
  rating: number | null;
  user_rating_count: number | null;
  // Google priceLevel enum value, e.g. "PRICE_LEVEL_MODERATE".
  price_level: string | null;
  // Weekly schedule, or null when Google returned no usable schedule.
  open_periods: LunchOpeningPeriod[] | null;
};

/**
 * Fetches Google's record of a lunch candidate already resolved to a place id
 * (via the free searchPlaceId lookup). Billed at the Place Details Enterprise
 * tier — callers must budget-gate and record it. Returns null when the
 * response is unusable.
 */
export async function fetchLunchPlaceDetails(input: {
  apiKey: string;
  placeId: string;
}): Promise<LunchRestaurantDetails | null> {
  const payload = await placesFetch({
    url: `${DETAILS_ENDPOINT}/${encodeURIComponent(input.placeId)}`,
    apiKey: input.apiKey,
    fieldMask: LUNCH_DETAILS_FIELD_MASK,
    method: "GET",
  });

  return parseLunchPlaceDetails(payload);
}

export function parseLunchPlaceDetails(
  payload: unknown,
): LunchRestaurantDetails | null {
  const record = asRecord(payload);
  const placeId = asString(record.id);
  const name = asString(asRecord(record.displayName).text);
  const location = asRecord(record.location);
  const latitude = asNumber(location.latitude);
  const longitude = asNumber(location.longitude);
  if (!placeId || !name || latitude === null || longitude === null) {
    return null;
  }

  return {
    place_id: placeId,
    name,
    latitude,
    longitude,
    google_maps_url: asString(record.googleMapsUri),
    business_status: asString(record.businessStatus),
    rating: asNumber(record.rating),
    user_rating_count: asNumber(record.userRatingCount),
    price_level: asString(record.priceLevel),
    open_periods: parseOpenPeriods(record.regularOpeningHours),
  };
}

function parseOpenPeriods(
  regularOpeningHours: unknown,
): LunchOpeningPeriod[] | null {
  const periods = asRecord(regularOpeningHours).periods;
  if (!Array.isArray(periods) || periods.length === 0) {
    return null;
  }

  const parsed: LunchOpeningPeriod[] = [];
  for (const period of periods) {
    const record = asRecord(period);
    const open = asRecord(record.open);
    const openDay = asNumber(open.day);
    if (openDay === null) continue;
    // Absent hour/minute mean midnight in Google's encoding.
    const openMinute = (asNumber(open.hour) ?? 0) * 60 + (asNumber(open.minute) ?? 0);
    // A period with no close marks an always-open place per the Places API.
    if (record.close === undefined || record.close === null) {
      parsed.push({
        open_day: openDay,
        open_minute: openMinute,
        close_day: null,
        close_minute: null,
      });
      continue;
    }
    const close = asRecord(record.close);
    const closeDay = asNumber(close.day);
    if (closeDay === null) continue;
    parsed.push({
      open_day: openDay,
      open_minute: openMinute,
      close_day: closeDay,
      close_minute:
        (asNumber(close.hour) ?? 0) * 60 + (asNumber(close.minute) ?? 0),
    });
  }

  return parsed.length > 0 ? parsed : null;
}

export type PlacePhotoReference = {
  photo_name: string | null;
  photo_attribution: string | null;
};

export async function fetchPlacePhotoReference(input: {
  apiKey: string;
  placeId: string;
}): Promise<PlacePhotoReference> {
  const payload = await placesFetch({
    url: `${DETAILS_ENDPOINT}/${encodeURIComponent(input.placeId)}`,
    apiKey: input.apiKey,
    fieldMask: PHOTO_REFERENCE_FIELD_MASK,
    method: "GET",
  });

  return parsePhotoReference(payload);
}

export type PlaceNameAndPhotoReference = PlacePhotoReference & {
  name: string | null;
};

/**
 * Resolves a place's display name alongside its photo reference. Google's map
 * POI card renders inside a closed shadow root, so the name a POI click shows
 * on screen is unreadable from the DOM and must come from here. Billed at the
 * Place Details Pro tier — callers must budget-gate and record it.
 */
export async function fetchPlaceNameAndPhotoReference(input: {
  apiKey: string;
  placeId: string;
}): Promise<PlaceNameAndPhotoReference> {
  const payload = await placesFetch({
    url: `${DETAILS_ENDPOINT}/${encodeURIComponent(input.placeId)}`,
    apiKey: input.apiKey,
    fieldMask: NAME_AND_PHOTO_FIELD_MASK,
    method: "GET",
  });

  return parseNameAndPhotoReference(payload);
}

export async function fetchPlacePhoto(input: {
  apiKey: string;
  photoName: string;
  maxWidthPx: number;
  maxHeightPx: number;
}): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // photoName already has "places/.../photos/..." form; its slashes are path
    // separators, so do not URL-encode them.
    const response = await fetch(
      `${PLACES_MEDIA_BASE}/${input.photoName}/media?maxWidthPx=${input.maxWidthPx}&maxHeightPx=${input.maxHeightPx}`,
      {
        method: "GET",
        headers: { "X-Goog-Api-Key": input.apiKey },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new GooglePlacesUpstreamError(
        "Google Places photo request failed.",
        response.status === 504 ? 504 : 502,
      );
    }

    return {
      bytes: await response.arrayBuffer(),
      contentType: response.headers.get("content-type") ?? "image/jpeg",
    };
  } catch (error) {
    if (error instanceof GooglePlacesUpstreamError) {
      throw error;
    }

    const status =
      error instanceof Error && error.name === "AbortError" ? 504 : 502;
    throw new GooglePlacesUpstreamError(
      "Google Places photo request failed.",
      status,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function placesFetch(input: {
  url: string;
  apiKey: string;
  fieldMask: string;
  method: "GET" | "POST";
  body?: unknown;
}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(input.url, {
      method: input.method,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": input.apiKey,
        "X-Goog-FieldMask": input.fieldMask,
      },
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new GooglePlacesUpstreamError(
        "Google Places API request failed.",
        response.status === 504 ? 504 : 502,
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof GooglePlacesUpstreamError) {
      throw error;
    }

    const status =
      error instanceof Error && error.name === "AbortError" ? 504 : 502;
    throw new GooglePlacesUpstreamError(
      "Google Places API request failed.",
      status,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function parseSuggestions(payload: unknown): DestinationSuggestion[] {
  const suggestions = asRecord(payload).suggestions;
  if (!Array.isArray(suggestions)) {
    return [];
  }

  const parsed: DestinationSuggestion[] = [];
  for (const suggestion of suggestions) {
    const prediction = asRecord(asRecord(suggestion).placePrediction);
    const placeId = asString(prediction.placeId);
    const structured = asRecord(prediction.structuredFormat);
    const primaryText = asString(asRecord(structured.mainText).text);
    if (!placeId || !primaryText) {
      continue;
    }

    parsed.push({
      place_id: placeId,
      primary_text: primaryText,
      secondary_text: asString(asRecord(structured.secondaryText).text),
    });
  }

  return parsed;
}

export function parseDetails(payload: unknown): DestinationDetails | null {
  const record = asRecord(payload);
  const placeId = asString(record.id);
  const name = asString(asRecord(record.displayName).text);
  const location = asRecord(record.location);
  const latitude = asNumber(location.latitude);
  const longitude = asNumber(location.longitude);

  if (!placeId || !name || latitude === null || longitude === null) {
    return null;
  }

  const photoName = parseFirstPhotoName(record.photos);

  return {
    place_id: placeId,
    name,
    latitude,
    longitude,
    google_maps_url: asString(record.googleMapsUri),
    country_code: parseCountryCode(record.addressComponents),
    photo_name: photoName,
    photo_attribution: photoName
      ? parseFirstPhotoAttribution(record.photos)
      : null,
  };
}

function parseCountryCode(addressComponents: unknown): string | null {
  if (!Array.isArray(addressComponents)) {
    return null;
  }
  for (const component of addressComponents) {
    const record = asRecord(component);
    const types = record.types;
    if (Array.isArray(types) && types.includes("country")) {
      return asString(record.shortText);
    }
  }
  return null;
}

export function parsePhotoReference(payload: unknown): PlacePhotoReference {
  const photos = asRecord(payload).photos;
  const photoName = parseFirstPhotoName(photos);

  return {
    photo_name: photoName,
    photo_attribution: photoName ? parseFirstPhotoAttribution(photos) : null,
  };
}

export function parseNameAndPhotoReference(
  payload: unknown,
): PlaceNameAndPhotoReference {
  return {
    ...parsePhotoReference(payload),
    name: asString(asRecord(asRecord(payload).displayName).text),
  };
}

function parseFirstPhotoName(photos: unknown): string | null {
  if (!Array.isArray(photos)) {
    return null;
  }
  return asString(asRecord(photos[0]).name);
}

function parseFirstPhotoAttribution(photos: unknown): string | null {
  if (!Array.isArray(photos)) {
    return null;
  }
  const attributions = asRecord(photos[0]).authorAttributions;
  if (!Array.isArray(attributions)) {
    return null;
  }
  return asString(asRecord(attributions[0]).displayName);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
