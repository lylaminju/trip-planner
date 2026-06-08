"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type SubmitEvent } from "react";

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
  type TimeZoneOption,
} from "@/lib/timezones";
import {
  createTrip,
  deleteTrip,
  loadTrips,
  updateTrip,
  type TripMetadataPayload,
} from "@/lib/trips-api";
import type { TripSummary } from "@/lib/types";
import { TripEditForm } from "./TripEditForm";
import { TripRow } from "./TripRow";
import { updateTripFormField } from "./trip-form-state";
import { TimeZoneSelect } from "./TimeZoneSelect";
import type { TripFormState } from "./trip-form-types";

export function TripsDashboard() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [form, setForm] = useState<TripFormState>(() => ({
    name: "",
    startDate: "",
    endDate: "",
    timezone: DEFAULT_TRIP_TIMEZONE,
  }));
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
  const editTimeZoneOptions = useMemo(
    () =>
      buildTimeZoneOptions({
        include: editing?.form.timezone ? [editing.form.timezone] : [],
        now: timeZoneReferenceDate(editing?.form.startDate, hasHydrated),
      }),
    [
      buildTimeZoneOptions,
      editing?.form.startDate,
      editing?.form.timezone,
      hasHydrated,
    ],
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
      setForm({
        name: "",
        startDate: "",
        endDate: "",
        timezone: detectBrowserTimeZone(),
      });
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
      <section className="trips-dashboard">
        <header className="trips-header">
          <div>
            <h1>Trips</h1>
          </div>
          <div className="trips-header-actions">
            <button type="button" onClick={logout}>
              Log out
            </button>
          </div>
        </header>

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
          <button
            type="submit"
            className="trip-form-submit"
            disabled={isSaving}
          >
            Create trip
          </button>
        </form>

        {error && <p className="error-text">{error}</p>}
        {isLoading ? (
          <p className="trip-empty-text">Loading trips...</p>
        ) : (
          <div className="trip-sections">
            <TripSection
              title="Ongoing Trips"
              trips={groups.ongoing}
              editing={editing}
              isSaving={isSaving}
              deletingTripIds={deletingTripIds}
              timeZoneOptions={editTimeZoneOptions}
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
              title="Needs Dates"
              trips={groups.needsDates}
              editing={editing}
              isSaving={isSaving}
              deletingTripIds={deletingTripIds}
              timeZoneOptions={editTimeZoneOptions}
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
              title="Upcoming Trips"
              trips={groups.upcoming}
              editing={editing}
              isSaving={isSaving}
              deletingTripIds={deletingTripIds}
              timeZoneOptions={editTimeZoneOptions}
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
              timeZoneOptions={editTimeZoneOptions}
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
    </main>
  );

  function setEditingFromTrip(trip: TripSummary) {
    setEditing({
      tripId: trip.id,
      form: formFromTrip(trip),
    });
  }
}

function TripSection(props: {
  title: string;
  trips: TripSummary[];
  editing: { tripId: number; form: TripFormState } | null;
  isSaving: boolean;
  deletingTripIds: Set<number>;
  timeZoneOptions: TimeZoneOption[];
  onEditStart: (trip: TripSummary) => void;
  onEditCancel: () => void;
  onEditChange: (form: TripFormState) => void;
  onEditSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onDelete: (trip: TripSummary) => void;
}) {
  return (
    <section className="trip-section">
      <div className="trip-section-heading">
        <h2>{props.title}</h2>
        <span>{props.trips.length}</span>
      </div>
      {props.trips.length === 0 ? (
        <p className="trip-empty-text">No trips in this section.</p>
      ) : (
        <div className="trip-list">
          {props.trips.map((trip) =>
            props.editing?.tripId === trip.id ? (
              <TripEditForm
                key={trip.id}
                form={props.editing.form}
                isSaving={props.isSaving}
                timeZoneOptions={props.timeZoneOptions}
                onChange={props.onEditChange}
                onCancel={props.onEditCancel}
                onSubmit={props.onEditSubmit}
              />
            ) : (
              <TripRow
                key={trip.id}
                trip={trip}
                isDeleting={props.deletingTripIds.has(trip.id)}
                onEdit={() => props.onEditStart(trip)}
                onDelete={() => props.onDelete(trip)}
              />
            ),
          )}
        </div>
      )}
    </section>
  );
}

function formPayload(form: TripFormState): TripMetadataPayload {
  return {
    name: form.name,
    start_date: form.startDate || null,
    end_date: form.endDate || null,
    timezone: form.timezone,
  };
}

function formFromTrip(trip: TripSummary): TripFormState {
  return {
    name: trip.name,
    startDate: trip.start_date ?? "",
    endDate: trip.end_date ?? "",
    timezone: trip.timezone,
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
