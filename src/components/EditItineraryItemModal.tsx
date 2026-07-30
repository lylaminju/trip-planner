"use client";

import { useState, type SubmitEvent } from "react";

import type { ItineraryItem, Place, VisitDateOption } from "@/lib/types";

import { ModalShell } from "./ModalShell";
import { VisitScheduleFields } from "./VisitScheduleFields";

type VisitModalMode = "add" | "edit" | "duplicate";

const MODAL_HEADINGS: Record<VisitModalMode, string> = {
  add: "Add visit",
  edit: "Edit visit",
  duplicate: "Duplicate visit",
};

type Props = {
  item?: ItineraryItem;
  place?: Place;
  mode?: VisitModalMode;
  visitDateOptions: VisitDateOption[];
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export function EditItineraryItemModal({
  item,
  place,
  mode,
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
  const resolvedMode: VisitModalMode = mode ?? (item ? "edit" : "add");
  // Only editing an existing visit can unschedule it (the item is deleted and
  // its place returns to the Unscheduled list). Adding or duplicating a visit
  // without a date has nothing to store, so the option is not offered.
  const allowUnscheduled = resolvedMode === "edit";

  const validDates = new Set(visitDateOptions.map((option) => option.value));
  const initialDate =
    item?.visit_date && validDates.has(item.visit_date)
      ? item.visit_date
      : null;

  const [visitDate, setVisitDate] = useState<string | null>(initialDate);
  const [visitTime, setVisitTime] = useState<string | null>(
    item?.visit_time ?? null,
  );
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const payload = {
      visit_date: visitDate,
      visit_time: visitDate ? visitTime : null,
      notes: notes.trim() || null,
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
    <ModalShell onClose={onCancel}>
      <div className="modal place-modal">
        <header className="place-modal-header">
          <div className="place-modal-header-left">
            <h2>{MODAL_HEADINGS[resolvedMode]}</h2>
          </div>
          <div className="place-modal-header-right">
            <button
              type="button"
              className="place-modal-close"
              onClick={onCancel}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </header>

        <form className="place-details" onSubmit={submit}>
          <div className="place-resolved">
            <div className="place-resolved-pin" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
              </svg>
            </div>
            <div className="place-resolved-body">
              <span className="place-card-title">{displayPlace.name}</span>
              {displayPlace.address && (
                <span className="place-resolved-found place-resolved-found--muted">
                  {displayPlace.address}
                </span>
              )}
            </div>
          </div>

          {(placeNotes || placeLinks.length > 0) && (
            <div className="place-context">
              {placeNotes && (
                <section
                  className="place-context-block"
                  aria-label="Original place notes"
                >
                  <span className="place-context-label">Place notes</span>
                  <p className="place-context-text">{placeNotes}</p>
                </section>
              )}
              {placeLinks.length > 0 && (
                <section className="place-context-block" aria-label="Place links">
                  <span className="place-context-label">Links</span>
                  <div className="place-context-links">
                    {placeLinks.map((link) => (
                      <a
                        key={link}
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {link}
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          <VisitScheduleFields
            visitDateOptions={visitDateOptions}
            visitDate={visitDate}
            visitTime={visitTime}
            allowUnscheduled={allowUnscheduled}
            onVisitDateChange={setVisitDate}
            onVisitTimeChange={setVisitTime}
          />

          <label className="place-field">
            <span className="place-field-label">Visit notes</span>
            <textarea
              className="place-input"
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
              placeholder="e.g. Meet Sarah at the entrance"
            />
          </label>

          {error && <p className="error-text">{error}</p>}

          <div className="place-actions">
            <button
              type="button"
              className="place-secondary-button"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="place-primary-button"
              disabled={isSaving || (!allowUnscheduled && visitDate === null)}
            >
              {isSaving && <span className="place-spinner" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
}
