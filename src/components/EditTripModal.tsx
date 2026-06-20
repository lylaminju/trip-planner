"use client";

import type { SubmitEvent } from "react";

import type { TimeZoneOption } from "@/lib/timezones";

import { DestinationCombobox } from "./DestinationCombobox";
import { ModalShell } from "./ModalShell";
import { TimeZoneSelect } from "./TimeZoneSelect";
import { updateTripFormField } from "./trip-form-state";
import type { TripFormState } from "./trip-form-types";

type Props = {
  form: TripFormState;
  isSaving: boolean;
  timeZoneOptions: TimeZoneOption[];
  onChange: (form: TripFormState) => void;
  onCancel: () => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
};

export function EditTripModal(props: Props) {
  return (
    <ModalShell onClose={props.onCancel}>
      <form className="modal" onSubmit={props.onSubmit}>
        <header className="modal-header">
          <h2>Edit trip</h2>
          <button
            type="button"
            className="icon-button"
            onClick={props.onCancel}
            aria-label="Close"
          >
            X
          </button>
        </header>

        <label>
          Name
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
          />
        </label>

        <label>
          Destination
          <DestinationCombobox
            value={props.form.destination}
            onChange={(destination) =>
              props.onChange(
                updateTripFormField(props.form, "destination", destination),
              )
            }
          />
        </label>

        <div className="form-grid">
          <label>
            Start
            <input
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
          </label>
          <label>
            End
            <input
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
          </label>
        </div>

        <label>
          Timezone
          <TimeZoneSelect
            value={props.form.timezone}
            options={props.timeZoneOptions}
            onChange={(timezone) =>
              props.onChange(
                updateTripFormField(props.form, "timezone", timezone),
              )
            }
          />
        </label>

        <footer className="modal-actions">
          <button type="button" onClick={props.onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={props.isSaving}>
            {props.isSaving ? "Saving..." : "Save changes"}
          </button>
        </footer>
      </form>
    </ModalShell>
  );
}
