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
  photo_name: string | null;
  photo_attribution: string | null;
};

// Thrown when live search is blocked (budget exhausted or per-user cap), so the
// caller can fall back to the free curated destination list.
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
): Promise<DestinationSuggestion[]> {
  const data = await postPlaces("/api/places/autocomplete", {
    query,
    session_token: sessionToken,
    ...(bias
      ? { bias_latitude: bias.latitude, bias_longitude: bias.longitude }
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

export type PlacePhoto = {
  // Freshly fetched from Google (the single billed Place Photo call); the
  // same data URL is previewed and sent back at save time.
  data_url: string | null;
  attribution: string | null;
  // Already stored in our own bucket for this place id; previewed as-is and
  // never re-uploaded — the save path re-resolves it server-side.
  image_url: string | null;
  image_credit: string | null;
};

// Resolves the preview photo for a place selection. The server first reuses an
// image we already stored for the place id (no Google call), then fetches via
// the known photo reference, then falls back to a free IDs-Only reference
// lookup for map POI picks.
export async function fetchPlacePhotoForPlace(input: {
  placeId: string;
  photoName: string | null;
}): Promise<PlacePhoto> {
  const data = await postPlaces("/api/places/photo", {
    place_id: input.placeId,
    ...(input.photoName ? { photo_name: input.photoName } : {}),
  });
  return {
    data_url: typeof data.data_url === "string" ? data.data_url : null,
    attribution:
      typeof data.attribution === "string" ? data.attribution : null,
    image_url: typeof data.image_url === "string" ? data.image_url : null,
    image_credit:
      typeof data.image_credit === "string" ? data.image_credit : null,
  };
}

async function postPlaces(
  path: string,
  body: Record<string, string | number>,
): Promise<Record<string, unknown>> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await readJson(response);

  if (response.status === 429) {
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
