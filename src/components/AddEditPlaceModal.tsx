"use client";

import { useState, type FormEvent } from "react";

import type { Place, VisitDateOption } from "@/lib/types";

import { TrashIcon } from "./Icons";
import { VisitDateField } from "./VisitDateField";

type Props = {
  place: Place | null;
  visitDateOptions: VisitDateOption[];
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export function AddEditPlaceModal({
  place,
  visitDateOptions,
  onCancel,
  onSave,
}: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<string[]>(place?.links ?? [""]);
  const [visitTimeHour, visitTimeMinute] = splitVisitTime(null);
  const isEditing = place !== null;

  async function submit(event: FormEvent<HTMLFormElement>) {
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
      payload.visit_time = composeVisitTime(form);
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
            required
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

function stringValue(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function nullableValue(form: FormData, key: string): string | null {
  const value = stringValue(form, key);
  return value || null;
}

function composeVisitTime(form: FormData): string | null {
  const hour = stringValue(form, "visit_time_hour");
  const minute = stringValue(form, "visit_time_minute");

  if (!hour && !minute) {
    return null;
  }

  if (!hour || !minute) {
    return null;
  }

  return `${hour}:${minute}`;
}

function splitVisitTime(value: string | null): [string, string] {
  if (!value) return ["", ""];

  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return ["", ""];

  return [match[1], match[2]];
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0"),
);
const MINUTE_OPTIONS = ["00", "10", "20", "30", "40", "50"] as const;
