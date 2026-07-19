"use client";

import type { SubmitEvent } from "react";

import { countryLabelForDestination } from "@/lib/destination-options";

import type { TripRole } from "@/lib/types";

import {
  DestinationSearch,
  type GoogleDestinationSelection,
} from "./DestinationSearch";
import { CloseIcon, MapPinIcon } from "./Icons";
import { ModalShell } from "./ModalShell";
import { TripDateRangePicker } from "./TripDateRangePicker";
import { TripInviteFields, type TripInviteDraft } from "./TripInviteFields";
import {
  tripDestinationFormChange,
  updateTripFormField,
} from "./trip-form-state";
import type { TripFormState } from "./trip-form-types";

type Props = {
  coverImage: string;
  error: string | null;
  form: TripFormState;
  invite: TripInviteDraft;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (form: TripFormState) => void;
  onSelectGoogleDestination: (selection: GoogleDestinationSelection) => void;
  onInviteChange: (invite: TripInviteDraft) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
};

export function CreateTripModal(props: Props) {
  const hasDestination = Boolean(props.form.destination.trim());
  const countryLabel = countryLabelForDestination(props.form.destinationSlug);

  return (
    <ModalShell className="trip-create-modal-backdrop" onClose={props.onCancel}>
      <form
        aria-labelledby="create-trip-title"
        aria-modal="true"
        className="modal trip-create-modal"
        id="create-trip-modal"
        role="dialog"
        onSubmit={props.onSubmit}
      >
        <div
          className="trip-create-hero"
          style={
            hasDestination
              ? { backgroundImage: `url("${props.coverImage}")` }
              : undefined
          }
        >
          {hasDestination ? (
            <>
              <div className="trip-create-hero-scrim" aria-hidden="true" />
              <div className="trip-create-hero-meta">
                <span className="trip-create-hero-title" id="create-trip-title">
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
              <span id="create-trip-title">
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
            <DestinationSearch
              value={props.form.destination}
              leadingIcon={<MapPinIcon />}
              showPreview
              onChange={(destination) =>
                props.onChange(
                  tripDestinationFormChange(props.form, destination),
                )
              }
              onSelectGoogle={props.onSelectGoogleDestination}
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
          </div>

          <div className="trip-members-invite-fields">
            <TripInviteFields
              email={props.invite.email}
              role={props.invite.role}
              emailLabel="Invite by email (optional)"
              emailRequired={false}
              onEmailChange={(email) =>
                props.onInviteChange({ ...props.invite, email })
              }
              onRoleChange={(role: TripRole) =>
                props.onInviteChange({ ...props.invite, role })
              }
            />
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
            disabled={props.isSaving}
          >
            {props.isSaving ? "Creating..." : "Create trip"}
          </button>
        </footer>
      </form>
    </ModalShell>
  );
}
