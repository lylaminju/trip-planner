import { normalizeDestinationText } from "./destination-options";
import type { Trip } from "./types";

export const AI_OPENING_HOURS_WARNING =
  "AI itinerary created. Opening hours may change, so check Google Maps or the venue before you go.";

export type TripDestinationContext = Pick<
  Trip,
  | "destination"
  | "destination_slug"
  | "destination_country_codes"
  | "destination_latitude"
  | "destination_longitude"
>;

// AI planning works for any trip whose destination can be keyed to a candidate
// catalog: curated destinations ship a seeded catalog, and everything else
// gets an AI-generated catalog on first use.
export function canPlanTripWithAi(
  trip: TripDestinationContext | null | undefined,
): boolean {
  return trip ? destinationCandidateKey(trip) !== null : false;
}

// Storage key for a trip's candidate catalog in ai_destination_candidates.
// Curated destinations use their preset slug; custom Google-searched
// destinations derive a stable key from country + normalized name + rounded
// coordinates so trips to the same place share one generated catalog.
export function destinationCandidateKey(
  trip: TripDestinationContext,
): string | null {
  if (trip.destination_slug) {
    return trip.destination_slug;
  }

  const normalizedName = normalizeDestinationText(trip.destination).replace(
    / /g,
    "-",
  );
  const coordinates =
    trip.destination_latitude !== null && trip.destination_longitude !== null
      ? `${trip.destination_latitude.toFixed(1)},${trip.destination_longitude.toFixed(1)}`
      : null;
  // A non-Latin destination name normalizes to nothing; without coordinates
  // either, there is no stable identity to key a shared catalog on.
  if (!normalizedName && !coordinates) {
    return null;
  }

  const country =
    trip.destination_country_codes?.[0]?.toLowerCase() ?? "xx";
  return [
    "custom",
    country,
    normalizedName || "place",
    coordinates ?? "na",
  ].join("-");
}
