"use client";

import type { MouseEvent, SubmitEvent } from "react";

import { DestinationCombobox } from "./DestinationCombobox";
import { TripDateRangePicker } from "./TripDateRangePicker";
import { updateTripFormField } from "./trip-form-state";
import type { TripFormState } from "./trip-form-types";

type Props = {
  coverImage: string;
  error: string | null;
  form: TripFormState;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (form: TripFormState) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
};

export function CreateTripModal(props: Props) {
  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.currentTarget === event.target) {
      props.onCancel();
    }
  }

  return (
    <div
      className="modal-backdrop trip-create-modal-backdrop"
      role="presentation"
      onClick={closeFromBackdrop}
    >
      <form
        aria-labelledby="create-trip-title"
        aria-modal="true"
        className="modal trip-create-modal"
        id="create-trip-modal"
        role="dialog"
        onSubmit={props.onSubmit}
      >
        <header className="modal-header">
          <h2 id="create-trip-title">Create trip</h2>
          <button
            type="button"
            className="icon-button"
            onClick={props.onCancel}
            aria-label="Close"
          >
            X
          </button>
        </header>

        {props.error && (
          <p className="error-text trip-create-error" role="alert">
            {props.error}
          </p>
        )}

        <label className="trip-form-name">
          <span>Name</span>
          <input
            value={props.form.name}
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
            autoFocus
          />
        </label>

        <label className="trip-form-destination">
          <span>Destination</span>
          <DestinationCombobox
            value={props.form.destination}
            onChange={(destination) =>
              props.onChange(
                updateTripFormField(props.form, "destination", destination),
              )
            }
          />
        </label>

        <div
          className="trip-form-cover"
          aria-hidden="true"
          style={{ backgroundImage: `url("${props.coverImage}")` }}
        />

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

        <footer className="modal-actions trip-form-actions">
          <button
            type="button"
            className="trip-form-cancel"
            disabled={props.isSaving}
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="trip-form-submit"
            disabled={props.isSaving}
          >
            {props.isSaving ? "Creating..." : "Create trip"}
          </button>
        </footer>
      </form>
    </div>
  );
}
