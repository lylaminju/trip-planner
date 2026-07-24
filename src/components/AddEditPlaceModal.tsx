"use client";

import { useEffect, useState, type SubmitEvent } from "react";

import { usePlacePreview } from "@/hooks/usePlacePreview";
import type { PlaceSearchBias } from "@/lib/places-api";
import type { ResolvedPlace } from "@/lib/planner-api";
import type { Place, VisitDateOption } from "@/lib/types";

import {
  AddPlaceSearchStep,
  type PlaceSearchSelection,
} from "./AddPlaceSearchStep";
import { TrashIcon } from "./Icons";
import { ModalShell } from "./ModalShell";
import { PlacePhotoHero } from "./PlacePhotoHero";
import { VisitScheduleFields } from "./VisitScheduleFields";

type Props = {
  tripId: number;
  isGuest?: boolean;
  place: Place | null;
  savedPlaces: Place[];
  visitDateOptions: VisitDateOption[];
  defaultVisitDate?: string | null;
  destinationBias?: PlaceSearchBias | null;
  destinationCountryCodes?: string[] | null;
  initialSearchPlace?: PlaceSearchSelection | null;
  onCancel: () => void;
  onResolveUrl: (googleMapsUrl: string) => Promise<ResolvedPlace>;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export function AddEditPlaceModal({
  tripId,
  isGuest = false,
  place,
  savedPlaces,
  visitDateOptions,
  defaultVisitDate,
  destinationBias,
  destinationCountryCodes,
  initialSearchPlace,
  onCancel,
  onResolveUrl,
  onSave,
}: Props) {
  const isEditing = place !== null;
  // Seeds the details step directly, e.g. when a place was picked from the map.
  const initialSelection = isEditing ? null : (initialSearchPlace ?? null);

  const [step, setStep] = useState<1 | 2>(
    isEditing || initialSelection ? 2 : 1,
  );
  const [url, setUrl] = useState(
    place?.google_maps_url ?? initialSelection?.google_maps_url ?? "",
  );
  const [canonicalUrl, setCanonicalUrl] = useState(
    place?.google_maps_url ?? initialSelection?.google_maps_url ?? "",
  );
  const [name, setName] = useState(place?.name ?? initialSelection?.name ?? "");
  // Google's name for the place, tracked apart from `name` so the user editing
  // their own label never rewrites it. Stored once at create time and reused by
  // later map-POI picks of the same place, sparing a billed Details lookup.
  const [canonicalName, setCanonicalName] = useState<string | null>(
    isEditing ? null : (initialSelection?.name || null),
  );
  const [hasResolvedName, setHasResolvedName] = useState(
    isEditing || Boolean(initialSelection && initialSelection.name !== ""),
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(
    defaultVisitDate ?? null,
  );
  const [visitTime, setVisitTime] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(isEditing);
  const [notes, setNotes] = useState(place?.notes ?? "");
  const [links, setLinks] = useState<string[]>(
    place?.links?.length ? place.links : [""],
  );
  const [searchPlace, setSearchPlace] = useState<PlaceSearchSelection | null>(
    initialSelection,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetches the place photo once for the hero preview; the same data URL is
  // sent back on save, so the billed Place Photo call never repeats. Map POI
  // picks arrive with no name, so it resolves that in the same request.
  const preview = usePlacePreview(isEditing ? null : searchPlace);
  const heroImageUrl = isEditing ? place.image_url : preview.imageUrl;

  // A map POI pick opens the modal before its name is known. Fill it in when it
  // lands, but never over anything already in the field — the user may have
  // started typing while the lookup was in flight.
  const { resolvedName } = preview;
  useEffect(() => {
    if (!resolvedName) return;
    setName((current) => (current.trim() ? current : resolvedName));
    setCanonicalName(resolvedName);
    setHasResolvedName(true);
  }, [resolvedName]);
  // In edit mode the photo is known up front and never loads, so a missing
  // image should hide the hero rather than show an empty placeholder. The add
  // flow keeps the hero to hold stable height while the photo is fetched.
  const showPhotoHero = isEditing ? place.image_url !== null : true;

  // Errors surface inside the search step; rejections propagate back to it.
  async function handleResolveUrl(googleMapsUrl: string) {
    const resolved = await onResolveUrl(googleMapsUrl);
    setSearchPlace(null);
    setUrl(googleMapsUrl);
    setCanonicalUrl(resolved.google_maps_url);
    setName(resolved.name ?? "");
    // Parsed out of the Google Maps link, so still Google's name, not the user's.
    setCanonicalName(resolved.name);
    setHasResolvedName(resolved.name !== null);
    setError(null);
    setStep(2);
  }

  function handleSelectSearchPlace(selection: PlaceSearchSelection) {
    setSearchPlace(selection);
    setUrl(selection.google_maps_url);
    setCanonicalUrl(selection.google_maps_url);
    setName(selection.name);
    // Came from Place Details, so it is canonical.
    setCanonicalName(selection.name || null);
    setHasResolvedName(true);
    setError(null);
    setStep(2);
  }

  // Whatever reaches step 2 next (search pick or resolved link) rewrites the
  // coordinates, so stale search coordinates must not survive going back.
  function backToSearchStep() {
    setStep(1);
    setSearchPlace(null);
    // Whatever is picked next owns the canonical name; a leftover one would
    // otherwise be stored against a different place.
    setCanonicalName(null);
    setError(null);
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

    setIsSaving(true);
    setError(null);

    // Awaits any in-flight photo fetch so a fast save still carries the
    // already-billed preview image. Candidate images resolve server-side.
    const photoPayload = isEditing ? null : await preview.getPhotoPayload();

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
          ...(searchPlace
            ? {
                google_place_id: searchPlace.google_place_id,
                latitude: searchPlace.latitude,
                longitude: searchPlace.longitude,
              }
            : {}),
          ...(canonicalName ? { google_place_name: canonicalName } : {}),
          ...(photoPayload ?? {}),
        };

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
                onClick={backToSearchStep}
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
          <AddPlaceSearchStep
            tripId={tripId}
            isGuest={isGuest}
            savedPlaces={savedPlaces}
            destinationBias={destinationBias ?? null}
            destinationCountryCodes={destinationCountryCodes ?? null}
            onSelectPlace={handleSelectSearchPlace}
            onResolveUrl={handleResolveUrl}
          />
        ) : (
          <form className="place-details" onSubmit={handleSave}>
            {showPhotoHero && (
              <PlacePhotoHero
                imageUrl={heroImageUrl}
                isLoading={!isEditing && preview.isLoading}
              />
            )}
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
                onClick={isEditing ? onCancel : backToSearchStep}
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
