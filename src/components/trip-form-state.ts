import type { TripMetadataPayload } from "@/lib/trips-api";
import { findDestinationOption } from "@/lib/destination-options";

import type { GoogleDestinationSelection } from "./DestinationSearch";
import type { TripFormState } from "./trip-form-types";

export function updateTripFormField<K extends keyof TripFormState>(
  form: TripFormState,
  field: K,
  value: TripFormState[K],
): TripFormState {
  return {
    ...form,
    [field]: value,
  };
}

export function tripMetadataPayloadFromForm(
  form: TripFormState,
): TripMetadataPayload {
  return {
    name: form.name,
    destination: form.destination,
    destination_slug: form.destinationSlug,
    destination_latitude: form.destinationLatitude,
    destination_longitude: form.destinationLongitude,
    destination_photo_data: form.destinationPhotoData,
    destination_photo_attribution: form.destinationPhotoAttribution,
    start_date: form.startDate || null,
    end_date: form.endDate || null,
  };
}

export function tripDestinationFormChange(
  form: TripFormState,
  destination: string,
): TripFormState {
  return {
    ...form,
    destination,
    destinationSlug: findDestinationOption(destination)?.slug ?? null,
    destinationLatitude: null,
    destinationLongitude: null,
    destinationPhotoData: null,
    destinationPhotoAttribution: null,
  };
}

export function tripGoogleDestinationChange(
  form: TripFormState,
  selection: GoogleDestinationSelection,
): TripFormState {
  return {
    ...form,
    destination: selection.destination,
    destinationSlug: null,
    destinationLatitude: selection.latitude,
    destinationLongitude: selection.longitude,
    // The cover image is loaded asynchronously after selection; keep it null
    // until those bytes arrive so a stale cover never lingers.
    destinationPhotoData: null,
    destinationPhotoAttribution: selection.photoAttribution,
  };
}
