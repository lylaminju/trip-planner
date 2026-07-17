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

// Thrown when live search is blocked (budget exhausted or per-user cap), so the
// caller can fall back to the free curated destination list.
export class DestinationSearchUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DestinationSearchUnavailableError";
  }
}

export async function fetchDestinationSuggestions(
  query: string,
  sessionToken: string,
): Promise<DestinationSuggestion[]> {
  const data = await postPlaces("/api/places/autocomplete", {
    query,
    session_token: sessionToken,
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

async function postPlaces(
  path: string,
  body: Record<string, string>,
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
