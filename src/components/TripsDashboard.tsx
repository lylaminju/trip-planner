"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type SubmitEvent } from "react";

import { getTripCoverImage } from "@/lib/city-covers";
import { logoutRequest } from "@/lib/planner-api";
import {
  DEFAULT_TRIP_TIMEZONE,
  detectBrowserTimeZone,
  groupTripsByTiming,
} from "@/lib/trip-classification";
import { errorMessage } from "@/lib/error-message";
import {
  getStableTimeZoneOptions,
  getTimeZoneOptions,
  STABLE_TIMEZONE_REFERENCE_DATE,
  timeZoneDateFromIsoDate,
} from "@/lib/timezones";
import {
  createTrip,
  deleteTrip,
  loadTrips,
  updateTrip,
  type TripMetadataPayload,
} from "@/lib/trips-api";
import type { TripSummary } from "@/lib/types";
import { DestinationCombobox } from "./DestinationCombobox";
import { TimeZoneSelect } from "./TimeZoneSelect";
import { TripSection } from "./TripSection";
import { updateTripFormField } from "./trip-form-state";
import type { TripFormState } from "./trip-form-types";

export { TripSection };

export function TripsDashboard(props: {
  userName?: string | null;
  userEmail?: string | null;
}) {
  const router = useRouter();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [form, setForm] = useState<TripFormState>(() =>
    emptyTripForm(DEFAULT_TRIP_TIMEZONE),
  );
  const [editing, setEditing] = useState<{
    tripId: number;
    form: TripFormState;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingTripIds, setDeletingTripIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [hasHydrated, setHasHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groups = useMemo(() => groupTripsByTiming(trips), [trips]);
  const featuredTrip = groups.ongoing[0] ?? groups.upcoming[0] ?? null;
  const activeTrips = useMemo(
    () => [
      ...(featuredTrip ? [featuredTrip] : []),
      ...groups.ongoing.filter((trip) => trip.id !== featuredTrip?.id),
      ...groups.upcoming.filter((trip) => trip.id !== featuredTrip?.id),
      ...groups.needsDates,
    ],
    [featuredTrip, groups.needsDates, groups.ongoing, groups.upcoming],
  );
  const displayName = props.userName?.trim() || "Traveler";
  const userEmail = props.userEmail?.trim();
  const createCoverImage = getTripCoverImage({
    destination: form.destination,
  });
  const buildTimeZoneOptions = hasHydrated
    ? getTimeZoneOptions
    : getStableTimeZoneOptions;
  const createTimeZoneOptions = useMemo(
    () =>
      buildTimeZoneOptions({
        include: [form.timezone],
        now: timeZoneReferenceDate(form.startDate, hasHydrated),
      }),
    [buildTimeZoneOptions, form.startDate, form.timezone, hasHydrated],
  );

  useEffect(() => {
    setHasHydrated(true);
    setForm((current) =>
      current.timezone === DEFAULT_TRIP_TIMEZONE
        ? { ...current, timezone: detectBrowserTimeZone() }
        : current,
    );

    loadTrips()
      .then((loadedTrips) => {
        setTrips(loadedTrips);
        setError(null);
      })
      .catch((reason) => {
        setError(errorMessage(reason, "Failed to load trips."));
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function submitCreate(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const trip = await createTrip(formPayload(form));
      setTrips((current) => [...current, trip]);
      resetCreateForm();
      router.push(`/trips/${trip.id}`);
    } catch (reason) {
      setError(errorMessage(reason, "Failed to create trip."));
    } finally {
      setIsSaving(false);
    }
  }

  async function submitEdit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    setIsSaving(true);
    setError(null);

    try {
      const trip = await updateTrip(editing.tripId, formPayload(editing.form));
      setTrips((current) =>
        current.map((entry) => (entry.id === trip.id ? trip : entry)),
      );
      setEditing(null);
    } catch (reason) {
      setError(errorMessage(reason, "Failed to update trip."));
    } finally {
      setIsSaving(false);
    }
  }

  async function removeTrip(trip: TripSummary) {
    if (
      !window.confirm(
        `Delete ${trip.name}?\n\nThis removes the trip and planner data permanently.`,
      )
    ) {
      return;
    }

    setError(null);
    setDeletingTripIds((current) => new Set(current).add(trip.id));
    try {
      await deleteTrip(trip.id);
      setTrips((current) => current.filter((entry) => entry.id !== trip.id));
    } catch (reason) {
      setError(errorMessage(reason, "Failed to delete trip."));
    } finally {
      setDeletingTripIds((current) => {
        const next = new Set(current);
        next.delete(trip.id);
        return next;
      });
    }
  }

  async function logout() {
    try {
      await logoutRequest();
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <main className="trips-page">
      <section className="trips-dashboard-shell">
        <aside className="trips-brand-rail">
          <div className="trips-service-mark">TripGlance</div>
          <button type="button" onClick={logout}>
            Log out
          </button>
        </aside>

        <section className="trips-main-pane">
          <header className="trips-header">
            <h1>Hi, {displayName}!</h1>
          </header>

          {error && <p className="error-text">{error}</p>}
          {isLoading ? (
            <p className="trip-empty-text">Loading trips...</p>
          ) : (
            <div className="trip-sections">
              <TripSection
                title="Ongoing & Upcoming"
                trips={activeTrips}
                featuredTripId={featuredTrip?.id}
                editing={editing}
                isSaving={isSaving}
                deletingTripIds={deletingTripIds}
                onEditStart={setEditingFromTrip}
                onEditCancel={() => setEditing(null)}
                onEditChange={(form) =>
                  setEditing((current) =>
                    current ? { ...current, form } : current,
                  )
                }
                onEditSubmit={submitEdit}
                onDelete={removeTrip}
              />
              <TripSection
                title="Past Trips"
                trips={groups.past}
                editing={editing}
                isSaving={isSaving}
                deletingTripIds={deletingTripIds}
                onEditStart={setEditingFromTrip}
                onEditCancel={() => setEditing(null)}
                onEditChange={(form) =>
                  setEditing((current) =>
                    current ? { ...current, form } : current,
                  )
                }
                onEditSubmit={submitEdit}
                onDelete={removeTrip}
              />
            </div>
          )}
        </section>

        <aside className="trips-side-rail">
          <section className="trips-profile-card">
            <div className="trips-avatar" aria-hidden="true">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="trips-profile-copy">
              <strong>{displayName}</strong>
              {userEmail && <span>{userEmail}</span>}
            </div>
          </section>

          <section className="trip-create-card">
            <div className="trip-create-heading">
              <h2>New trip</h2>
            </div>
            <form className="trip-form" onSubmit={submitCreate}>
              <label className="trip-form-name">
                <span>Name</span>
                <input
                  value={form.name}
                  onChange={(event) => {
                    const { value } = event.currentTarget;
                    setForm((current) =>
                      updateTripFormField(current, "name", value),
                    );
                  }}
                  required
                />
              </label>
              <label className="trip-form-destination">
                <span>Destination</span>
                <DestinationCombobox
                  value={form.destination}
                  onChange={(value) => {
                    setForm((current) =>
                      updateTripFormField(current, "destination", value),
                    );
                  }}
                />
              </label>
              <div
                className="trip-form-cover"
                aria-hidden="true"
                style={{ backgroundImage: `url("${createCoverImage}")` }}
              />
              <div className="trip-form-date-row">
                <label className="trip-form-date-start">
                  <span>Start</span>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(event) => {
                      const { value } = event.currentTarget;
                      setForm((current) =>
                        updateTripFormField(current, "startDate", value),
                      );
                    }}
                  />
                </label>
                <label className="trip-form-date-end">
                  <span>End</span>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(event) => {
                      const { value } = event.currentTarget;
                      setForm((current) =>
                        updateTripFormField(current, "endDate", value),
                      );
                    }}
                  />
                </label>
              </div>
              <label className="trip-form-timezone">
                <span>Timezone</span>
                <TimeZoneSelect
                  value={form.timezone}
                  options={createTimeZoneOptions}
                  onChange={(timezone) =>
                    setForm((current) => ({
                      ...current,
                      timezone,
                    }))
                  }
                />
              </label>
              <div className="trip-form-actions">
                <button
                  type="submit"
                  className="trip-form-submit"
                  disabled={isSaving}
                >
                  Create trip
                </button>
                <button
                  type="button"
                  className="trip-form-clear"
                  disabled={isSaving}
                  onClick={resetCreateForm}
                >
                  Clear
                </button>
              </div>
            </form>
          </section>
        </aside>
      </section>
    </main>
  );

  function setEditingFromTrip(trip: TripSummary) {
    setEditing({
      tripId: trip.id,
      form: formFromTrip(trip),
    });
  }

  function resetCreateForm() {
    setForm(emptyTripForm(detectBrowserTimeZone()));
  }
}

function formPayload(form: TripFormState): TripMetadataPayload {
  return {
    name: form.name,
    destination: form.destination,
    start_date: form.startDate || null,
    end_date: form.endDate || null,
    timezone: form.timezone,
  };
}

function formFromTrip(trip: TripSummary): TripFormState {
  return {
    name: trip.name,
    destination: trip.destination,
    startDate: trip.start_date ?? "",
    endDate: trip.end_date ?? "",
    timezone: trip.timezone,
  };
}

function emptyTripForm(timezone: string): TripFormState {
  return {
    name: "",
    destination: "",
    startDate: "",
    endDate: "",
    timezone,
  };
}

function timeZoneReferenceDate(
  isoDate: string | undefined,
  hasHydrated: boolean,
): Date {
  return hasHydrated
    ? timeZoneDateFromIsoDate(isoDate)
    : timeZoneDateFromIsoDate(isoDate, STABLE_TIMEZONE_REFERENCE_DATE);
}
