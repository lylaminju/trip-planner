import { DEFAULT_TRIP_TIMEZONE } from "@/lib/trip-classification";
import type { TripMetadataPayload } from "@/lib/trips-api";

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
    start_date: form.startDate || null,
    end_date: form.endDate || null,
    timezone: form.timezone || DEFAULT_TRIP_TIMEZONE,
  };
}
