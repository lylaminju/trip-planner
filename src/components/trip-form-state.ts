import type {
  TripMetadataPayload,
  TripMetadataUpdatePayload,
} from "@/lib/trips-api";
import type { TripDateRange } from "@/lib/trip-date-shift";
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
    destination_country_codes: form.destinationCountryCodes,
    destination_photo_data: form.destinationPhotoData,
    destination_photo_attribution: form.destinationPhotoAttribution,
    start_date: form.startDate || null,
    end_date: form.endDate || null,
  };
}

export function tripUpdatePayloadFromForm(
  form: TripFormState,
  previous: TripDateRange,
): TripMetadataUpdatePayload {
  const { start_date, end_date, ...metadata } =
    tripMetadataPayloadFromForm(form);
  // An unchanged range is not a date edit: don't overwrite dates another tab
  // may have moved since this editor opened.
  return start_date === previous.start_date && end_date === previous.end_date
    ? metadata
    : { ...metadata, start_date, end_date };
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
    destinationCountryCodes: null,
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
    destinationCountryCodes: selection.countryCode
      ? [selection.countryCode]
      : null,
    // The cover image is loaded asynchronously after selection; keep it null
    // until those bytes arrive so a stale cover never lingers.
    destinationPhotoData: null,
    destinationPhotoAttribution: selection.photoAttribution,
  };
}
