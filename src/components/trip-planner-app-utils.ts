import { buildItinerary, type ItineraryDateRange } from "@/lib/itinerary";
import type { PlannerSnapshot, Trip } from "@/lib/types";

import type { TripFormState } from "./trip-form-types";

export function buildItineraryForTrip(
  plannerSnapshot: PlannerSnapshot,
  trip: Trip | null,
) {
  return buildItinerary(
    plannerSnapshot.itineraryItems,
    plannerSnapshot.routeSegments,
    plannerSnapshot.places,
    toTripDateRange(trip),
  );
}

export function toTripDateRange(
  trip: Trip | null,
): ItineraryDateRange | undefined {
  if (!trip) {
    return undefined;
  }

  return {
    startDate: trip.start_date,
    endDate: trip.end_date,
  };
}

export function formFromTrip(trip: Trip): TripFormState {
  return {
    name: trip.name,
    destination: trip.destination,
    destinationSlug: trip.destination_slug,
    destinationLatitude: trip.destination_latitude,
    destinationLongitude: trip.destination_longitude,
    destinationCountryCodes: trip.destination_country_codes,
    // Editing never re-fetches a photo, so the form carries no cover image;
    // the stored cover on the trip is left untouched by updates.
    destinationPhotoData: null,
    destinationPhotoAttribution: null,
    startDate: trip.start_date ?? "",
    endDate: trip.end_date ?? "",
  };
}
