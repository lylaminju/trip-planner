import type { SubmitEvent } from "react";

import type { TimeZoneOption } from "@/lib/timezones";
import { TimeZoneSelect } from "./TimeZoneSelect";
import type { TripFormState } from "./trip-form-types";

export function TripEditForm(props: {
  form: TripFormState;
  isSaving: boolean;
  timeZoneOptions: TimeZoneOption[];
  onChange: (form: TripFormState) => void;
  onCancel: () => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="trip-row trip-edit-form" onSubmit={props.onSubmit}>
      <input
        value={props.form.name}
        onChange={(event) =>
          props.onChange({ ...props.form, name: event.currentTarget.value })
        }
        required
      />
      <input
        type="date"
        value={props.form.startDate}
        onChange={(event) =>
          props.onChange({
            ...props.form,
            startDate: event.currentTarget.value,
          })
        }
      />
      <input
        type="date"
        value={props.form.endDate}
        onChange={(event) =>
          props.onChange({ ...props.form, endDate: event.currentTarget.value })
        }
      />
      <TimeZoneSelect
        value={props.form.timezone}
        options={props.timeZoneOptions}
        onChange={(timezone) => props.onChange({ ...props.form, timezone })}
        ariaLabel="Timezone"
      />
      <div className="trip-row-actions">
        <button type="submit" disabled={props.isSaving}>
          Save
        </button>
        <button type="button" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
