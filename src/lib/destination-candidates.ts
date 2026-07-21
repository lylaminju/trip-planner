import type { AiDestinationCandidate, Place } from "./types";

type SavedPlaceKey = Pick<Place, "google_place_id" | "latitude" | "longitude">;

// Candidates the Add Place search offers before the query is long enough for
// live Google search: already-saved places are hidden, and a short query
// narrows the list by name or area.
export function matchDestinationCandidates(
  candidates: AiDestinationCandidate[],
  savedPlaces: SavedPlaceKey[],
  query: string,
): AiDestinationCandidate[] {
  const available = candidates.filter(
    (candidate) => !isAlreadySaved(candidate, savedPlaces),
  );
  if (!query) return available;
  const lowered = query.toLowerCase();
  return available.filter(
    (candidate) =>
      candidate.name.toLowerCase().includes(lowered) ||
      (candidate.area?.toLowerCase().includes(lowered) ?? false),
  );
}

// A candidate picked from this dropdown is stored with its exact coordinates,
// so the coordinate match catches saved candidates that have no Google place
// id; the place id match catches the same POI added via live Google search.
function isAlreadySaved(
  candidate: AiDestinationCandidate,
  savedPlaces: SavedPlaceKey[],
): boolean {
  return savedPlaces.some(
    (place) =>
      (candidate.google_place_id !== null &&
        place.google_place_id === candidate.google_place_id) ||
      (place.latitude === candidate.latitude &&
        place.longitude === candidate.longitude),
  );
}
