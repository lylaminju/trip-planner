import { useId, type SubmitEvent } from "react";

import { useTripDateEditValidation } from "@/hooks/useTripDateEditValidation";
import { getTripCoverImage } from "@/lib/city-covers";
import type { TripSummary } from "@/lib/types";
import {
  DestinationSearch,
  type GoogleDestinationSelection,
} from "./DestinationSearch";
import { TripDateRangePicker } from "./TripDateRangePicker";
import { TripDateChangeNotice } from "./TripDateChangeNotice";
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
  onSelectGoogle: (selection: GoogleDestinationSelection) => void;
  onCancel: () => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
}) {
  const nameId = useId();
  const destinationId = useId();
  const dateNoticeId = useId();
  const dateValidation = useTripDateEditValidation(props.trip, {
    start_date: props.form.startDate || null,
    end_date: props.form.endDate || null,
  });
  const dateDescription =
    dateValidation.error ||
    dateValidation.isChecking ||
    dateValidation.willShift
      ? dateNoticeId
      : undefined;
  const saveDisabled =
    props.isSaving ||
    dateValidation.isChecking ||
    Boolean(dateValidation.error);
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
    <form
      className={className}
      onSubmit={(event) => {
        if (saveDisabled) {
          event.preventDefault();
          return;
        }
        props.onSubmit(event);
      }}
    >
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
        <DestinationSearch
          inputId={destinationId}
          value={props.form.destination}
          onChange={(destination) =>
            props.onChange(tripDestinationFormChange(props.form, destination))
          }
          onSelectGoogle={props.onSelectGoogle}
        />

        <div
          className="trip-edit-date-row"
          role="group"
          aria-label="Trip dates"
          aria-describedby={dateDescription}
        >
          <TripDateRangePicker
            startDate={props.form.startDate}
            endDate={props.form.endDate}
            onChange={(range) =>
              props.onChange({
                ...props.form,
                startDate: range.startDate,
                endDate: range.endDate,
              })
            }
          />
          <TripDateChangeNotice
            id={dateNoticeId}
            error={dateValidation.error}
            isChecking={dateValidation.isChecking}
            willShift={dateValidation.willShift}
            onRetry={dateValidation.retry}
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
          disabled={saveDisabled}
          aria-describedby={dateDescription}
        >
          Save
        </button>
      </div>
    </form>
  );
}
