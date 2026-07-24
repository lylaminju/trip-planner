"use client";

import type { SubmitEvent } from "react";

import { getTripCoverImage } from "@/lib/city-covers";
import { countryLabelForDestination } from "@/lib/destination-options";
import {
  GUEST_DESTINATION_SLUGS,
  GUEST_TRIP_MAX_DAYS,
} from "@/lib/guest-mode";

import { DestinationCombobox } from "./DestinationCombobox";
import { CloseIcon, MapPinIcon } from "./Icons";
import { ModalShell } from "./ModalShell";
import { TripDateRangePicker } from "./TripDateRangePicker";
import {
  tripDestinationFormChange,
  updateTripFormField,
} from "./trip-form-state";
import type { TripFormState } from "./trip-form-types";

type Props = {
  form: TripFormState;
  isGuest?: boolean;
  error: string | null;
  isSaving: boolean;
  onChange: (form: TripFormState) => void;
  onCancel: () => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
};

export function EditTripModal(props: Props) {
  const hasDestination = Boolean(props.form.destination.trim());
  const countryLabel = countryLabelForDestination(props.form.destinationSlug);
  const coverImage = getTripCoverImage({
    destination: props.form.destination,
    destinationSlug: props.form.destinationSlug,
  });

  return (
    <ModalShell className="trip-create-modal-backdrop" onClose={props.onCancel}>
      <form
        aria-labelledby="edit-trip-title"
        aria-modal="true"
        className="modal trip-create-modal"
        id="edit-trip-modal"
        role="dialog"
        onSubmit={props.onSubmit}
      >
        <div
          className="trip-create-hero"
          style={
            hasDestination
              ? { backgroundImage: `url("${coverImage}")` }
              : undefined
          }
        >
          {hasDestination ? (
            <>
              <div className="trip-create-hero-scrim" aria-hidden="true" />
              <div className="trip-create-hero-meta">
                <span className="trip-create-hero-title" id="edit-trip-title">
                  {props.form.destination}
                </span>
                {countryLabel ? (
                  <span className="trip-create-hero-country">
                    {countryLabel}
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <div className="trip-create-hero-empty">
              <span className="trip-create-hero-empty-icon" aria-hidden="true">
                <MapPinIcon />
              </span>
              <span id="edit-trip-title">
                Pick a destination to see it come alive
              </span>
            </div>
          )}
          <button
            type="button"
            className="trip-create-hero-close"
            onClick={props.onCancel}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="trip-create-body">
          {props.error && (
            <p className="error-text trip-create-error" role="alert">
              {props.error}
            </p>
          )}

          <label className="trip-create-field trip-create-name-field">
            <span className="trip-create-field-label">Trip name</span>
            <input
              className="trip-create-name-input"
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

          <div className="trip-create-field">
            <span className="trip-create-field-label">Destination</span>
            <DestinationCombobox
              value={props.form.destination}
              leadingIcon={<MapPinIcon />}
              showPreview
              allowedSlugs={props.isGuest ? GUEST_DESTINATION_SLUGS : undefined}
              onChange={(destination) =>
                props.onChange(
                  tripDestinationFormChange(props.form, destination),
                )
              }
            />
          </div>

          <div className="trip-create-field trip-create-dates-field">
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
            {props.isGuest && (
              <p className="trip-create-field-note">
                Guest trips use the curated destination list and are limited
                to {GUEST_TRIP_MAX_DAYS} days.
                <br />
                <a href="/sign-in">Sign in</a> to plan anywhere, for longer
                trips.
              </p>
            )}
          </div>
        </div>

        <footer className="modal-actions trip-form-actions trip-create-footer">
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
            disabled={props.isSaving || !hasDestination}
          >
            {props.isSaving ? "Saving..." : "Save changes"}
          </button>
        </footer>
      </form>
    </ModalShell>
  );
}
