import { buildItinerary, type ItineraryDateRange } from "@/lib/itinerary";
import type { TripMetadataPayload } from "@/lib/trips-api";
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

export function formPayload(form: TripFormState): TripMetadataPayload {
  return {
    name: form.name,
    destination: form.destination,
    destination_slug: form.destinationSlug,
    destination_latitude: form.destinationLatitude,
    destination_longitude: form.destinationLongitude,
    start_date: form.startDate || null,
    end_date: form.endDate || null,
  };
}

export function formFromTrip(trip: Trip): TripFormState {
  return {
    name: trip.name,
    destination: trip.destination,
    destinationSlug: trip.destination_slug,
    destinationLatitude: trip.destination_latitude,
    destinationLongitude: trip.destination_longitude,
    startDate: trip.start_date ?? "",
    endDate: trip.end_date ?? "",
  };
}
