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
  country_code: string | null;
  photo_name: string | null;
  photo_attribution: string | null;
};

// Thrown when live search is blocked (budget exhausted, per-user cap, or the
// request is unauthenticated — e.g. guest mode, where the places routes are
// user-only), so the caller can fall back to pasting a Google Maps link or the
// free curated destination list.
export class DestinationSearchUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DestinationSearchUnavailableError";
  }
}

export type PlaceSearchBias = {
  latitude: number;
  longitude: number;
};

export async function fetchDestinationSuggestions(
  query: string,
  sessionToken: string,
  bias?: PlaceSearchBias | null,
  countryCodes?: string[] | null,
): Promise<DestinationSuggestion[]> {
  const data = await postPlaces("/api/places/autocomplete", {
    query,
    session_token: sessionToken,
    ...(bias
      ? { bias_latitude: bias.latitude, bias_longitude: bias.longitude }
      : {}),
    ...(countryCodes && countryCodes.length
      ? { country_codes: countryCodes }
      : {}),
  });
  return Array.isArray(data.suggestions)
    ? (data.suggestions as DestinationSuggestion[])
    : [];
}

export async function fetchDestinationDetails(
  placeId: string,
  sessionToken: string,
): Promise<DestinationDetails> {
  const data = await postPlaces("/api/places/details", {
    place_id: placeId,
    session_token: sessionToken,
  });
  return data.place as DestinationDetails;
}

// Fetches the cover photo once (the single billed Place Photo call) and returns
// it as a data URL, reused for both the modal preview and the stored cover.
export async function fetchDestinationPhoto(
  photoName: string,
): Promise<string> {
  const data = await postPlaces("/api/places/photo", {
    photo_name: photoName,
  });
  return data.data_url as string;
}

export type PlaceNameAndPhoto = {
  // Display name resolved server-side. Only map POI picks need it — Google's
  // POI card is a closed shadow root, so the name it shows cannot be read from
  // the DOM. Null when the place was already known by name, when the lookup
  // returned nothing, or when the Places budget blocked it.
  name: string | null;
  // Freshly fetched from Google (the single billed Place Photo call); the
  // same data URL is previewed and sent back at save time.
  data_url: string | null;
  attribution: string | null;
  // Already stored in our own bucket for this place id; previewed as-is and
  // never re-uploaded. Its credit is deliberately absent: the save path
  // re-resolves the stored image and its credit server-side, so nothing on the
  // client ever reads one.
  image_url: string | null;
};

// Resolves the preview photo, and for map POI picks the name, for a place
// selection. The server first reuses what we already stored for the place id
// (no Google call), then fetches via the known photo reference, then falls back
// to a billed Place Details Pro lookup that returns name and photo together.
export async function fetchPlaceNameAndPhoto(input: {
  placeId: string;
  photoName: string | null;
}): Promise<PlaceNameAndPhoto> {
  const data = await postPlaces("/api/places/photo", {
    place_id: input.placeId,
    ...(input.photoName ? { photo_name: input.photoName } : {}),
  });
  return {
    name: typeof data.name === "string" ? data.name : null,
    data_url: typeof data.data_url === "string" ? data.data_url : null,
    attribution:
      typeof data.attribution === "string" ? data.attribution : null,
    image_url: typeof data.image_url === "string" ? data.image_url : null,
  };
}

async function postPlaces(
  path: string,
  body: Record<string, string | number | string[]>,
): Promise<Record<string, unknown>> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await readJson(response);

  // 429 (budget/cap exhausted) and 401 (unauthenticated — e.g. guest mode) both
  // mean live search can't run, so the caller falls back to pasting a link
  // instead of surfacing a dead "No matching places" state.
  if (response.status === 429 || response.status === 401) {
    throw new DestinationSearchUnavailableError(
      typeof data.error === "string"
        ? data.error
        : "Live destination search is unavailable right now.",
    );
  }

  if (!response.ok) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Destination search failed.",
    );
  }

  return data;
}

async function readJson(
  response: Response,
): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
