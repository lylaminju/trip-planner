import {
  GooglePlacesConfigError,
  GooglePlacesUpstreamError,
} from "@/server/errors";

export type DestinationSuggestion = {
  place_id: string;
  primary_text: string;
  secondary_text: string | null;
};

export type DestinationDetails = {
  place_id: string;
  name: string;
  latitude: number;
  longitude: number;
  google_maps_url: string | null;
};

const AUTOCOMPLETE_ENDPOINT =
  "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places";
const REQUEST_TIMEOUT_MS = 8_000;

const AUTOCOMPLETE_FIELD_MASK =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat";
// Keep the details field mask inside Place Details Pro so a lookup never
// escalates into the pricier Enterprise/Atmosphere tiers.
const DETAILS_FIELD_MASK = "id,displayName,location,googleMapsUri";

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
}): Promise<DestinationSuggestion[]> {
  const payload = await placesFetch({
    url: AUTOCOMPLETE_ENDPOINT,
    apiKey: input.apiKey,
    fieldMask: AUTOCOMPLETE_FIELD_MASK,
    method: "POST",
    body: {
      input: input.query,
      sessionToken: input.sessionToken,
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

  return {
    place_id: placeId,
    name,
    latitude,
    longitude,
    google_maps_url: asString(record.googleMapsUri),
  };
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
