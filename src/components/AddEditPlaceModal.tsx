"use client";

import { useState, type SubmitEvent } from "react";

import { nullableValue, stringValue } from "@/lib/form-data";
import type { Place, VisitDateOption } from "@/lib/types";
import {
  composeVisitTime,
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  splitVisitTime,
} from "@/lib/visit-time";

import { TrashIcon } from "./Icons";
import { VisitDateField } from "./VisitDateField";

type Props = {
  place: Place | null;
  visitDateOptions: VisitDateOption[];
  defaultVisitDate?: string | null;
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export function AddEditPlaceModal({
  place,
  visitDateOptions,
  defaultVisitDate,
  onCancel,
  onSave,
}: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<string[]>(place?.links ?? [""]);
  const [visitTimeHour, visitTimeMinute] = splitVisitTime(null);
  const isEditing = place !== null;

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {
      google_maps_url: stringValue(form, "google_maps_url"),
      name: stringValue(form, "name"),
      address: nullableValue(form, "address"),
      notes: nullableValue(form, "notes"),
      links: links.map((link) => link.trim()).filter(Boolean),
    };
    if (!isEditing) {
      payload.visit_date = nullableValue(form, "visit_date");
      payload.visit_time = composeVisitTime(
        stringValue(form, "visit_time_hour"),
        stringValue(form, "visit_time_minute"),
      );
    }

    try {
      await onSave(payload);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Failed to save place.",
      );
      setIsSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={submit}>
        <header className="modal-header">
          <h2>{isEditing ? "Edit Place" : "Add Place"}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onCancel}
            aria-label="Close"
          >
            X
          </button>
        </header>

        <label>
          Google Maps URL
          <input
            name="google_maps_url"
            required
            defaultValue={place?.google_maps_url ?? ""}
          />
        </label>

        <label>
          Name
          <input
            name="name"
            required={isEditing}
            defaultValue={place?.name ?? ""}
            placeholder="Auto-filled when possible"
          />
        </label>

        <label>
          Address
          <input name="address" defaultValue={place?.address ?? ""} />
        </label>

        {!isEditing && (
          <div className="form-grid">
            <VisitDateField
              label="Initial visit date"
              name="visit_date"
              defaultValue={defaultVisitDate}
              options={visitDateOptions}
            />
            <div className="time-picker">
              <span className="field-label">Initial visit time</span>
              <div className="time-picker-grid">
                <select name="visit_time_hour" defaultValue={visitTimeHour}>
                  <option value="">Hour</option>
                  {HOUR_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <select
                  name="visit_time_minute"
                  defaultValue={visitTimeMinute || "00"}
                >
                  {MINUTE_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <label>
          Place notes
          <textarea name="notes" rows={5} defaultValue={place?.notes ?? ""} />
        </label>

        <fieldset className="modal-links-fieldset">
          <legend>Links</legend>
          <div className="modal-links-list">
            {links.map((link, index) => (
              <div key={index} className="modal-link-row">
                <input
                  type="url"
                  value={link}
                  placeholder="https://example.com"
                  onChange={(event) => {
                    const nextValue = event.currentTarget.value;
                    setLinks((current) =>
                      current.map((value, valueIndex) =>
                        valueIndex === index ? nextValue : value,
                      ),
                    );
                  }}
                />
                <button
                  type="button"
                  className="icon-button danger-button"
                  aria-label="Remove link"
                  title="Remove link"
                  onClick={() =>
                    setLinks((current) =>
                      current.length === 1
                        ? [""]
                        : current.filter(
                            (_, valueIndex) => valueIndex !== index,
                          ),
                    )
                  }
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setLinks((current) => [...current, ""])}
          >
            Add link
          </button>
        </fieldset>

        {error && <p className="error-text">{error}</p>}

        <footer className="modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </button>
        </footer>
      </form>
    </div>
  );
}
