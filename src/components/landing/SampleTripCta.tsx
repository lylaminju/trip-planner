"use client";

import { useState } from "react";

import { createGuestTrip } from "@/lib/guest-api";

// Clones the sample trip into a fresh guest session and opens the planner.
// Navigates with location.assign: the jump from the static landing page into
// the app is a full document load either way.
export function SampleTripCta() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openSampleTrip() {
    setIsPending(true);
    setError(null);
    try {
      const { tripId } = await createGuestTrip({ mode: "sample" });
      window.location.assign(`/trips/${tripId}`);
    } catch (reason) {
      setIsPending(false);
      setError(
        reason instanceof Error
          ? reason.message
          : "The sample trip is unavailable right now.",
      );
    }
  }

  return (
    <>
      <button
        type="button"
        className="landing-primary-action landing-sample-trip-cta"
        disabled={isPending}
        onClick={openSampleTrip}
      >
        {isPending ? "Opening sample trip…" : "Explore a sample trip"}
      </button>
      {error && (
        <p className="error-text landing-sample-trip-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
