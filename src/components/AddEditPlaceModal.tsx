"use client";

import { useState, type SubmitEvent } from "react";

import type { ResolvedPlace } from "@/lib/planner-api";
import type { Place, VisitDateOption } from "@/lib/types";

import { TrashIcon } from "./Icons";
import { ModalShell } from "./ModalShell";
import { VisitScheduleFields } from "./VisitScheduleFields";

type Props = {
  place: Place | null;
  visitDateOptions: VisitDateOption[];
  defaultVisitDate?: string | null;
  onCancel: () => void;
  onResolveUrl: (googleMapsUrl: string) => Promise<ResolvedPlace>;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export function AddEditPlaceModal({
  place,
  visitDateOptions,
  defaultVisitDate,
  onCancel,
  onResolveUrl,
  onSave,
}: Props) {
  const isEditing = place !== null;

  const [step, setStep] = useState<1 | 2>(isEditing ? 2 : 1);
  const [url, setUrl] = useState(place?.google_maps_url ?? "");
  const [canonicalUrl, setCanonicalUrl] = useState(place?.google_maps_url ?? "");
  const [name, setName] = useState(place?.name ?? "");
  const [hasResolvedName, setHasResolvedName] = useState(isEditing);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    defaultVisitDate ?? null,
  );
  const [visitTime, setVisitTime] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(isEditing);
  const [notes, setNotes] = useState(place?.notes ?? "");
  const [links, setLinks] = useState<string[]>(
    place?.links?.length ? place.links : [""],
  );
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResolve(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Paste a Google Maps link first.");
      return;
    }

    setIsResolving(true);
    setError(null);
    try {
      const resolved = await onResolveUrl(trimmed);
      setCanonicalUrl(resolved.google_maps_url);
      setName(resolved.name ?? "");
      setHasResolvedName(resolved.name !== null);
      setStep(2);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Failed to resolve link.",
      );
    } finally {
      setIsResolving(false);
    }
  }

  async function handleSave(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isEditing && !url.trim()) {
      setError("Google Maps link is required.");
      return;
    }
    if (!name.trim()) {
      setError("Add a name for this place.");
      return;
    }

    const trimmedLinks = links.map((link) => link.trim()).filter(Boolean);
    const payload: Record<string, unknown> = isEditing
      ? {
          google_maps_url: url.trim(),
          name: name.trim(),
          notes: notes.trim() || null,
          links: trimmedLinks,
        }
      : {
          google_maps_url: canonicalUrl || url.trim(),
          name: name.trim(),
          notes: notes.trim() || null,
          links: trimmedLinks,
          visit_date: selectedDate,
          visit_time: selectedDate ? visitTime : null,
        };

    setIsSaving(true);
    setError(null);
    try {
      await onSave(payload);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Failed to save place.",
      );
      setIsSaving(false);
    }
  }

  const title = isEditing ? "Edit place" : "Add place";

  return (
    <ModalShell onClose={onCancel}>
      <div className="modal place-modal">
        <header className="place-modal-header">
          <div className="place-modal-header-left">
            {!isEditing && step === 2 && (
              <button
                type="button"
                className="place-modal-back"
                aria-label="Back"
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
              >
                ←
              </button>
            )}
            <h2>{title}</h2>
          </div>
          <div className="place-modal-header-right">
            {!isEditing && (
              <div className="place-steps" aria-hidden="true">
                <span className="place-step-dot place-step-dot--active" />
                <span
                  className={
                    step === 2
                      ? "place-step-dot place-step-dot--active"
                      : "place-step-dot"
                  }
                />
              </div>
            )}
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

        {!isEditing && step === 1 ? (
          <form className="place-paste" onSubmit={handleResolve}>
            <div className="place-paste-intro">
              <div className="place-paste-icon" aria-hidden="true">
                🔗
              </div>
              <p className="place-paste-title">Paste a Google Maps link</p>
              <p className="place-paste-hint">
                Share a place from Google Maps and we&apos;ll pull in its name
                and pin automatically.
              </p>
            </div>
            <input
              className="place-paste-input"
              value={url}
              onChange={(event) => setUrl(event.currentTarget.value)}
              placeholder="https://maps.app.goo.gl/…"
              autoFocus
              aria-label="Google Maps link"
            />
            {error && <p className="error-text">{error}</p>}
            <button
              type="submit"
              className="place-primary-button"
              disabled={isResolving}
            >
              {isResolving && <span className="place-spinner" />}
              Continue
            </button>
          </form>
        ) : (
          <form className="place-details" onSubmit={handleSave}>
            <div className="place-resolved">
              <div className="place-resolved-pin" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
                </svg>
              </div>
              <div className="place-resolved-body">
                <input
                  className="place-resolved-name"
                  value={name}
                  onChange={(event) => setName(event.currentTarget.value)}
                  placeholder="Place name"
                  aria-label="Place name"
                />
                <span
                  className={
                    hasResolvedName
                      ? "place-resolved-found"
                      : "place-resolved-found place-resolved-found--muted"
                  }
                >
                  {hasResolvedName
                    ? "✓ Found on Google Maps"
                    : "Add a name for this place"}
                </span>
              </div>
            </div>

            {isEditing && (
              <label className="place-field">
                <span className="place-field-label">Google Maps link</span>
                <input
                  className="place-input"
                  value={url}
                  onChange={(event) => setUrl(event.currentTarget.value)}
                  placeholder="https://maps.app.goo.gl/…"
                />
              </label>
            )}

            {!isEditing && (
              <VisitScheduleFields
                visitDateOptions={visitDateOptions}
                visitDate={selectedDate}
                visitTime={visitTime}
                onVisitDateChange={setSelectedDate}
                onVisitTimeChange={setVisitTime}
              />
            )}

            <div className="place-disclosure">
              <button
                type="button"
                className="place-disclosure-toggle"
                onClick={() => setNotesOpen((open) => !open)}
                aria-expanded={notesOpen}
              >
                <span className="place-disclosure-caret" aria-hidden="true">
                  {notesOpen ? "▾" : "▸"}
                </span>{" "}
                Notes &amp; links
              </button>
              {notesOpen && (
                <div className="place-disclosure-body">
                  <textarea
                    className="place-input"
                    rows={3}
                    value={notes}
                    onChange={(event) => setNotes(event.currentTarget.value)}
                    placeholder="e.g. Book tickets ahead, closed Tuesdays"
                  />
                  <div className="place-links-list">
                    {links.map((link, index) => (
                      <div key={index} className="place-link-row">
                        <input
                          type="url"
                          className="place-input"
                          value={link}
                          placeholder="https://… (reservation, article)"
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
                          className="place-link-remove"
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
                    className="place-add-link"
                    onClick={() => setLinks((current) => [...current, ""])}
                  >
                    Add link
                  </button>
                </div>
              )}
            </div>

            {error && <p className="error-text">{error}</p>}

            <div className="place-actions">
              <button
                type="button"
                className="place-secondary-button"
                onClick={
                  isEditing
                    ? onCancel
                    : () => {
                        setStep(1);
                        setError(null);
                      }
                }
              >
                {isEditing ? "Cancel" : "Back"}
              </button>
              <button
                type="submit"
                className="place-primary-button"
                disabled={isSaving}
              >
                {isSaving && <span className="place-spinner" />}
                {isEditing ? "Save" : "Add place"}
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalShell>
  );
}
