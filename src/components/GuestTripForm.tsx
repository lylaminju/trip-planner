"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";

import { getTripCoverImage } from "@/lib/city-covers";
import {
  countryLabelForDestination,
  findDestinationOption,
} from "@/lib/destination-options";
import { createGuestTrip } from "@/lib/guest-api";
import {
  exceedsGuestTripLength,
  GUEST_DESTINATION_SLUGS,
  GUEST_TRIP_MAX_DAYS,
} from "@/lib/guest-mode";

import { DestinationCombobox } from "./DestinationCombobox";
import { CloseIcon, MapPinIcon } from "./Icons";
import { ModalShell } from "./ModalShell";
import { TripDateRangePicker } from "./TripDateRangePicker";

// Guest-mode counterpart of CreateTripModal: curated destinations only, no
// Google search, no invites, and a hard trip-length cap.
export function GuestTripForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const matchedOption = findDestinationOption(destination);
  const destinationSlug =
    matchedOption && GUEST_DESTINATION_SLUGS.includes(matchedOption.slug)
      ? matchedOption.slug
      : null;
  const hasDestination = Boolean(destination.trim());
  const countryLabel = countryLabelForDestination(destinationSlug);
  const coverImage = getTripCoverImage({
    destination,
    destinationSlug,
  });

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!destinationSlug) {
      setError("Pick one of the curated destinations to try the demo.");
      return;
    }
    if (exceedsGuestTripLength(startDate || null, endDate || null)) {
      setError(
        `Guest trips are limited to ${GUEST_TRIP_MAX_DAYS} days. Sign in to plan longer trips.`,
      );
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const { tripId } = await createGuestTrip({
        mode: "new",
        name: name.trim() || `My ${destination} trip`,
        destination_slug: destinationSlug,
        start_date: startDate || null,
        end_date: endDate || null,
      });
      router.push(`/trips/${tripId}`);
    } catch (reason) {
      setIsSaving(false);
      setError(
        reason instanceof Error ? reason.message : "Could not create the trip.",
      );
    }
  }

  return (
    <ModalShell
      className="trip-create-modal-backdrop"
      onClose={() => router.push("/")}
    >
      <form
        aria-labelledby="guest-trip-title"
        aria-modal="true"
        className="modal trip-create-modal"
        id="guest-trip-form"
        role="dialog"
        onSubmit={submit}
      >
        <div
          className="trip-create-hero"
          style={
            hasDestination
              ? { backgroundImage: `url("${coverImage}")` }
              : undefined
          }
        >
          {hasDestination ? (
            <>
              <div className="trip-create-hero-scrim" aria-hidden="true" />
              <div className="trip-create-hero-meta">
                <span className="trip-create-hero-title" id="guest-trip-title">
                  {destination}
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
              <span id="guest-trip-title">
                Try the planner — no sign-up needed
              </span>
            </div>
          )}
          <button
            type="button"
            className="trip-create-hero-close"
            onClick={() => router.push("/")}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="trip-create-body">
          {error && (
            <p className="error-text trip-create-error" role="alert">
              {error}
            </p>
          )}

          <label className="trip-create-field trip-create-name-field">
            <span className="trip-create-field-label">Trip name</span>
            <input
              className="trip-create-name-input"
              value={name}
              placeholder="My demo trip"
              onChange={(event) => setName(event.currentTarget.value)}
              autoFocus
            />
          </label>

          <div className="trip-create-field">
            <span className="trip-create-field-label">Destination</span>
            <DestinationCombobox
              value={destination}
              leadingIcon={<MapPinIcon />}
              showPreview
              allowedSlugs={GUEST_DESTINATION_SLUGS}
              onChange={setDestination}
            />
            <p className="trip-create-field-note">
              The free demo uses curated destinations with ready-made
              attraction lists. Trips up to {GUEST_TRIP_MAX_DAYS} days.
            </p>
          </div>

          <div className="trip-create-field trip-create-dates-field">
            <TripDateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(range) => {
                setStartDate(range.startDate);
                setEndDate(range.endDate);
              }}
            />
          </div>
        </div>

        <footer className="modal-actions trip-form-actions trip-create-footer">
          <button
            type="button"
            className="trip-form-cancel"
            disabled={isSaving}
            onClick={() => router.push("/")}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="trip-form-submit"
            disabled={isSaving}
          >
            {isSaving ? "Creating..." : "Start planning"}
          </button>
        </footer>
      </form>
    </ModalShell>
  );
}
