"use client";

import { useState, type FormEvent } from "react";

import type { Place } from "@/lib/types";

type Props = {
  place: Place | null;
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export function AddEditPlaceModal({ place, onCancel, onSave }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visitTimeHour, visitTimeMinute] = splitVisitTime(place?.visit_time ?? null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      google_maps_url: stringValue(form, "google_maps_url"),
      name: stringValue(form, "name"),
      address: nullableValue(form, "address"),
      notes: nullableValue(form, "notes"),
      visit_date: nullableValue(form, "visit_date"),
      visit_time: composeVisitTime(form),
    };

    try {
      await onSave(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to save place.");
      setIsSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={submit}>
        <header className="modal-header">
          <h2>{place ? "Edit Place" : "Add Place"}</h2>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Close">
            X
          </button>
        </header>

        <label>
          Google Maps URL
          <input name="google_maps_url" required defaultValue={place?.google_maps_url ?? ""} />
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

        <div className="form-grid">
          <label>
            Date
            <input type="date" name="visit_date" defaultValue={place?.visit_date ?? ""} />
          </label>
          <div className="time-picker">
            <span className="field-label">Time</span>
            <div className="time-picker-grid">
              <select name="visit_time_hour" defaultValue={visitTimeHour}>
                <option value="">Hour</option>
                {HOUR_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <select name="visit_time_minute" defaultValue={visitTimeMinute || "00"}>
                {MINUTE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <label>
          Notes
          <textarea name="notes" rows={5} defaultValue={place?.notes ?? ""} />
        </label>

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

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTE_OPTIONS = ["00", "10", "20", "30", "40", "50"] as const;
