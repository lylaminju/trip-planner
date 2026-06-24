import { useId, type SubmitEvent } from "react";

import { getTripCoverImage } from "@/lib/city-covers";
import type { TripSummary } from "@/lib/types";
import { DestinationCombobox } from "./DestinationCombobox";
import {
  tripDestinationFormChange,
  updateTripFormField,
} from "./trip-form-state";
import type { TripFormState } from "./trip-form-types";

export function TripEditForm(props: {
  trip: TripSummary;
  form: TripFormState;
  isFeatured?: boolean;
  isSaving: boolean;
  onChange: (form: TripFormState) => void;
  onCancel: () => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
}) {
  const nameId = useId();
  const destinationId = useId();
  const startDateId = useId();
  const endDateId = useId();
  const coverImage = getTripCoverImage({
    destination: props.form.destination || props.trip.destination,
    destinationSlug: props.form.destinationSlug,
  });
  const className = [
    "trip-row",
    props.isFeatured ? "featured-trip" : null,
    "trip-row-editing",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <form className={className} onSubmit={props.onSubmit}>
      <div
        className="trip-edit-cover"
        aria-hidden="true"
        style={{ backgroundImage: `url("${coverImage}")` }}
      />
      <div className="trip-edit-fields">
        <label className="sr-only" htmlFor={nameId}>
          Trip name
        </label>
        <input
          id={nameId}
          value={props.form.name}
          placeholder="Trip name"
          onChange={(event) =>
            props.onChange(
              updateTripFormField(
                props.form,
                "name",
                event.currentTarget.value,
              ),
            )
          }
          required
        />

        <label className="sr-only" htmlFor={destinationId}>
          Destination
        </label>
        <DestinationCombobox
          inputId={destinationId}
          value={props.form.destination}
          onChange={(destination) =>
            props.onChange(tripDestinationFormChange(props.form, destination))
          }
        />

        <div className="trip-edit-date-row">
          <label className="sr-only" htmlFor={startDateId}>
            Start date
          </label>
          <input
            id={startDateId}
            type="date"
            value={props.form.startDate}
            onChange={(event) =>
              props.onChange(
                updateTripFormField(
                  props.form,
                  "startDate",
                  event.currentTarget.value,
                ),
              )
            }
          />
          <label className="sr-only" htmlFor={endDateId}>
            End date
          </label>
          <input
            id={endDateId}
            type="date"
            value={props.form.endDate}
            onChange={(event) =>
              props.onChange(
                updateTripFormField(
                  props.form,
                  "endDate",
                  event.currentTarget.value,
                ),
              )
            }
          />
        </div>
      </div>
      <div className="trip-row-actions trip-edit-actions">
        <button
          type="button"
          className="trip-edit-cancel"
          disabled={props.isSaving}
          onClick={props.onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="trip-edit-submit"
          disabled={props.isSaving}
        >
          Save changes
        </button>
      </div>
    </form>
  );
}
