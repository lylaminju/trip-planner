"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type SubmitEvent } from "react";

import { getTripCoverImage } from "@/lib/city-covers";
import { logoutRequest } from "@/lib/planner-api";
import { groupTripsByTiming } from "@/lib/trip-classification";
import { errorMessage } from "@/lib/error-message";
import { isTripOngoing } from "@/lib/trip-classification";
import { createTrip, deleteTrip, loadTrips, updateTrip } from "@/lib/trips-api";
import type { TripSummary } from "@/lib/types";
import { CreateTripModal } from "./CreateTripModal";
import { FeaturedTripCard } from "./FeaturedTripCard";
import { FoldedMapIcon } from "./Icons";
import { TripEditForm } from "./TripEditForm";
import { TripsDashboardRail } from "./TripsDashboardRail";
import { TripSection } from "./TripSection";
import { tripMetadataPayloadFromForm } from "./trip-form-state";
import type { TripFormState } from "./trip-form-types";

export { TripSection };

type TripSectionOpenState = {
  active: boolean;
  past: boolean;
};

export function defaultTripSectionOpenState(
  trips: TripSummary[],
  now = new Date(),
): TripSectionOpenState {
  const groups = groupTripsByTiming(trips, now);
  const hasOngoingUpcomingTrips =
    groups.ongoing.length > 0 ||
    groups.upcoming.length > 0 ||
    groups.needsDates.length > 0;

  return {
    active: true,
    past: !hasOngoingUpcomingTrips,
  };
}

export function TripsDashboard(props: {
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  profileColor?: string;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [form, setForm] = useState<TripFormState>(() => emptyTripForm());
  const [editing, setEditing] = useState<{
    tripId: number;
    form: TripFormState;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingTripIds, setDeletingTripIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [openTripSections, setOpenTripSections] =
    useState<TripSectionOpenState>({
      active: true,
      past: true,
    });
  const [error, setError] = useState<string | null>(null);
  const groups = useMemo(() => groupTripsByTiming(trips), [trips]);
  const featuredTrip = groups.ongoing[0] ?? groups.upcoming[0] ?? null;
  const upcomingTrips = useMemo(
    () => [
      ...groups.ongoing.filter((trip) => trip.id !== featuredTrip?.id),
      ...groups.upcoming.filter((trip) => trip.id !== featuredTrip?.id),
      ...groups.needsDates,
    ],
    [featuredTrip, groups.needsDates, groups.ongoing, groups.upcoming],
  );
  const isEditingFeatured =
    !!featuredTrip && editing?.tripId === featuredTrip.id;
  const isEmptyState = !isLoading && trips.length === 0;
  const displayName = props.userName?.trim() || "Traveler";
  const userEmail = props.userEmail?.trim();
  const isAdmin = props.isAdmin ?? false;
  const createCoverImage = getTripCoverImage({
    destination: form.destination,
    destinationSlug: form.destinationSlug,
  });

  useEffect(() => {
    loadTrips()
      .then((loadedTrips) => {
        setTrips(loadedTrips);
        setOpenTripSections(defaultTripSectionOpenState(loadedTrips));
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
      const trip = await createTrip(tripMetadataPayloadFromForm(form));
      setTrips((current) => [...current, trip]);
      resetCreateForm();
      setIsCreateModalOpen(false);
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
      const trip = await updateTrip(
        editing.tripId,
        tripMetadataPayloadFromForm(editing.form),
      );
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
        `Delete ${trip.name}?\n\nThis removes the trip and its planner data from your dashboard.`,
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

  function openCreateModal() {
    setError(null);
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    resetCreateForm();
    setError(null);
    setIsCreateModalOpen(false);
  }

  function toggleTripSection(section: keyof typeof openTripSections) {
    setOpenTripSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  return (
    <main className="trips-page">
      <section className="trips-dashboard-shell">
        <TripsDashboardRail
          displayName={displayName}
          userEmail={userEmail}
          profileColor={props.profileColor}
          onLogout={logout}
          isAdmin={isAdmin}
        />

        <section className="trips-main-pane">
          {!isEmptyState && (
            <header className="trips-header">
              <h1>Hi, {displayName}</h1>
              <div className="trips-header-actions">
                <button
                  type="button"
                  className="trip-create-trigger"
                  aria-controls="create-trip-modal"
                  aria-expanded={isCreateModalOpen}
                  aria-haspopup="dialog"
                  onClick={openCreateModal}
                >
                  + New Trip
                </button>
              </div>
            </header>
          )}

          {error && !isCreateModalOpen && <p className="error-text">{error}</p>}
          {isLoading ? (
            <p className="trip-empty-text">Loading trips...</p>
          ) : isEmptyState ? (
            <div className="trips-empty-state">
              <div className="trips-empty-state-card">
                <span className="trips-empty-state-icon">
                  <FoldedMapIcon />
                </span>
                <div className="trips-empty-state-copy">
                  <h2>Plan your first trip</h2>
                  <p>
                    Map your stops, set the dates,
                    <br />
                    and see the whole trip at a glance.
                  </p>
                </div>
                <button
                  type="button"
                  className="trip-create-trigger trips-empty-state-cta"
                  aria-controls="create-trip-modal"
                  aria-expanded={isCreateModalOpen}
                  aria-haspopup="dialog"
                  onClick={openCreateModal}
                >
                  + New Trip
                </button>
              </div>
            </div>
          ) : (
            <div className="trip-sections">
              {featuredTrip &&
                (isEditingFeatured && editing ? (
                  <TripEditForm
                    trip={featuredTrip}
                    form={editing.form}
                    isFeatured
                    isSaving={isSaving}
                    onChange={(form) =>
                      setEditing((current) =>
                        current ? { ...current, form } : current,
                      )
                    }
                    onCancel={() => setEditing(null)}
                    onSubmit={submitEdit}
                  />
                ) : (
                  <FeaturedTripCard
                    trip={featuredTrip}
                    isOngoing={isTripOngoing(featuredTrip)}
                    currentUserId={props.userId}
                    canEdit={featuredTrip.role === "owner"}
                    isDeleting={deletingTripIds.has(featuredTrip.id)}
                    onEdit={() => setEditingFromTrip(featuredTrip)}
                    onDelete={() => removeTrip(featuredTrip)}
                  />
                ))}

              {upcomingTrips.length > 0 && (
                <TripSection
                  sectionId="upcoming-trips"
                  title="Upcoming"
                  variant="upcoming"
                  trips={upcomingTrips}
                  currentUserId={props.userId}
                  isOpen={openTripSections.active}
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
                  onToggleOpen={() => toggleTripSection("active")}
                />
              )}

              {groups.past.length > 0 && (
                <TripSection
                  sectionId="past-trips"
                  title="Past trips"
                  variant="past"
                  trips={groups.past}
                  currentUserId={props.userId}
                  isOpen={openTripSections.past}
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
                  onToggleOpen={() => toggleTripSection("past")}
                />
              )}
            </div>
          )}
        </section>
      </section>

      {isCreateModalOpen && (
        <CreateTripModal
          coverImage={createCoverImage}
          error={error}
          form={form}
          isSaving={isSaving}
          onCancel={closeCreateModal}
          onChange={setForm}
          onSubmit={submitCreate}
        />
      )}
    </main>
  );

  function setEditingFromTrip(trip: TripSummary) {
    setEditing({
      tripId: trip.id,
      form: formFromTrip(trip),
    });
  }

  function resetCreateForm() {
    setForm(emptyTripForm());
  }
}

function formFromTrip(trip: TripSummary): TripFormState {
  return {
    name: trip.name,
    destination: trip.destination,
    destinationSlug: trip.destination_slug,
    startDate: trip.start_date ?? "",
    endDate: trip.end_date ?? "",
  };
}

function emptyTripForm(): TripFormState {
  return {
    name: "",
    destination: "",
    destinationSlug: null,
    startDate: "",
    endDate: "",
  };
}
