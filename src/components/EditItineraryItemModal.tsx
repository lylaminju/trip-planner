"use client";

import { useState, type SubmitEvent } from "react";

import { nullableValue, stringValue } from "@/lib/form-data";
import type { ItineraryItem, Place, VisitDateOption } from "@/lib/types";
import {
  composeVisitTime,
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  splitVisitTime,
} from "@/lib/visit-time";

import { VisitDateField } from "./VisitDateField";

type Props = {
  item?: ItineraryItem;
  place?: Place;
  visitDateOptions: VisitDateOption[];
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export function EditItineraryItemModal({
  item,
  place,
  visitDateOptions,
  onCancel,
  onSave,
}: Props) {
  const displayPlace = item?.place ?? place;
  if (!displayPlace) {
    throw new Error("EditItineraryItemModal requires an item or place.");
  }
  const placeNotes = displayPlace.notes?.trim() || null;
  const placeLinks = displayPlace.links.filter(
    (link) => link.trim().length > 0,
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visitTimeHour, visitTimeMinute] = splitVisitTime(
    item?.visit_time ?? null,
  );
  const isCreating = !item;

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      visit_date: nullableValue(form, "visit_date"),
      visit_time: composeVisitTime(
        stringValue(form, "visit_time_hour"),
        stringValue(form, "visit_time_minute"),
      ),
      notes: nullableValue(form, "notes"),
    };

    try {
      await onSave(payload);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Failed to save visit.",
      );
      setIsSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={submit}>
        <header className="modal-header">
          <h2>{isCreating ? "Add Visit" : "Edit Visit"}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onCancel}
            aria-label="Close"
          >
            X
          </button>
        </header>

        <p className="modal-subtitle">{displayPlace.name}</p>

        {placeNotes && (
          <section
            className="modal-note-block"
            aria-label="Original place notes"
          >
            <span className="modal-note-label">Place notes</span>
            <p className="modal-note-text">{placeNotes}</p>
          </section>
        )}

        {placeLinks.length > 0 && (
          <section className="modal-note-block" aria-label="Place links">
            <span className="modal-note-label">Links</span>
            <div className="modal-links-readonly">
              {placeLinks.map((link) => (
                <a key={link} href={link} target="_blank" rel="noreferrer">
                  {link}
                </a>
              ))}
            </div>
          </section>
        )}

        <div className="form-grid">
          <VisitDateField
            label="Visit date"
            name="visit_date"
            defaultValue={item?.visit_date ?? ""}
            options={visitDateOptions}
          />
          <div className="time-picker">
            <span className="field-label">Visit time</span>
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

        <label>
          Visit notes
          <textarea name="notes" rows={5} defaultValue={item?.notes ?? ""} />
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
