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
// destinations key on their rounded coordinates so every trip to the same
// place shares one generated catalog.
//
// Coordinates are the identity. The country code is deliberately excluded: it
// is redundant with the coordinates and is often absent on a trip, so folding
// it in split one destination across several catalogs depending on whichever
// metadata happened to be resolved ("custom-xx-los-angeles-34.1,-118.2" and
// "custom-us-los-angeles-34.1,-118.2" were the same city). For the same
// reason a missing value never becomes a placeholder segment: without
// coordinates there is no stable identity, so the destination is not
// AI-plannable until it has them.
export function destinationCandidateKey(
  trip: TripDestinationContext,
): string | null {
  if (trip.destination_slug) {
    return trip.destination_slug;
  }

  if (trip.destination_latitude == null || trip.destination_longitude == null) {
    return null;
  }

  // A non-Latin destination name normalizes to nothing; the coordinates still
  // identify the catalog, so the name is only a readable label here.
  const normalizedName = normalizeDestinationText(trip.destination).replace(
    / /g,
    "-",
  );
  const coordinates = `${trip.destination_latitude.toFixed(1)},${trip.destination_longitude.toFixed(1)}`;

  return ["custom", normalizedName || "place", coordinates].join("-");
}
