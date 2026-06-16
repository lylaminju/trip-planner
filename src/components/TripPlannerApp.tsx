"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SubmitEvent,
} from "react";

import { useCurrentLocationControl } from "@/hooks/useCurrentLocationControl";
import { useItineraryExport } from "@/hooks/useItineraryExport";
import { useRouteGeometries } from "@/hooks/useRouteGeometries";
import { useTripPlannerModals } from "@/hooks/useTripPlannerModals";
import { toggleCollapsedDate } from "@/lib/date-collapse";
import { buildVisitDateOptions } from "@/lib/itinerary";
import type { MobileSheetState } from "@/lib/mobile-sheet";
import {
  createItineraryItemRequest,
  deleteItineraryItemRequest,
  deletePlaceRequest,
  loadTripPlannerInitialData,
  logoutRequest,
  saveItineraryItemRequest,
  savePlaceRequest,
  scheduleItineraryItemRequest,
  schedulePlaceRequest,
  updateSegmentModeRequest,
} from "@/lib/planner-api";
import { toggleSelectedId } from "@/lib/selection";
import { SERVICE_TITLE } from "@/lib/service-brand";
import { isTripOngoing } from "@/lib/trip-classification";
import { formatTripPeriodLabel } from "@/lib/trip-period-label";
import { getTimeZoneOptions, timeZoneDateFromIsoDate } from "@/lib/timezones";
import { updateTrip } from "@/lib/trips-api";
import type {
  PlannerSnapshot,
  Trip,
  TripPlannerInitialData,
  TripRole,
  TravelMode,
} from "@/lib/types";

import {
  buildItineraryForTrip,
  errorMessage,
  formPayload,
  toTripDateRange,
} from "./trip-planner-app-utils";
import { TripPlannerView } from "./TripPlannerView";

const EMPTY_SNAPSHOT: PlannerSnapshot = {
  places: [],
  itineraryItems: [],
  routeSegments: [],
};

type TripPlannerAppProps = {
  tripId: number;
  initialData?: TripPlannerInitialData;
};

export function TripPlannerApp({ tripId, initialData }: TripPlannerAppProps) {
  const [trip, setTrip] = useState<Trip | null>(
    () => initialData?.trip ?? null,
  );
  const [role, setRole] = useState<TripRole>(
    () => initialData?.role ?? "viewer",
  );
  const [plannerSnapshot, setPlannerSnapshot] = useState<PlannerSnapshot>(
    () => initialData?.plannerSnapshot ?? EMPTY_SNAPSHOT,
  );
  const didUseInitialDataRef = useRef(Boolean(initialData));
  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const [activeCanonicalPlaceId, setActiveCanonicalPlaceId] = useState<
    number | null
  >(null);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(
    () => new Set(),
  );
  const [isPlannerPanelExpanded, setIsPlannerPanelExpanded] = useState(false);
  const [mobileSheetState, setMobileSheetState] =
    useState<MobileSheetState>("half");
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingPlaceIds, setDeletingPlaceIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [deletingItineraryItemIds, setDeletingItineraryItemIds] = useState<
    Set<number>
  >(() => new Set());

  const itinerary = useMemo(
    () => buildItineraryForTrip(plannerSnapshot, trip),
    [plannerSnapshot, trip],
  );
  const visitDateOptions = useMemo(
    () => buildVisitDateOptions(toTripDateRange(trip)),
    [trip],
  );
  const canAddVisits = visitDateOptions.length > 0;
  const { routeGeometries, routeGeometryError } = useRouteGeometries(
    tripId,
    plannerSnapshot,
  );
  const canEdit = role !== "viewer";
  const canEditTripMetadata = role === "owner";
  const tripTitle = trip?.name ?? SERVICE_TITLE;
  const tripPeriodLabel = formatTripPeriodLabel(trip);
  const { exportFeedback, copyMarkdownExport, downloadMarkdownExport } =
    useItineraryExport(tripTitle, itinerary);
  const canShowCurrentLocation = trip ? isTripOngoing(trip) : false;
  const {
    currentLocationPosition,
    currentLocationToast,
    isCurrentLocationEnabled,
    toggleCurrentLocation,
  } = useCurrentLocationControl(canShowCurrentLocation);
  const {
    addPlaceVisitDate,
    addingVisitPlace,
    closeModal,
    editingItem,
    editingPlace,
    editingTripForm,
    isAdding,
    openAddModal,
    openAddVisitModal,
    openEditItemModal,
    openEditModal,
    openEditTripModal,
    setAddingVisitPlace,
    setEditingItem,
    setEditingTripForm,
  } = useTripPlannerModals({
    canEdit,
    canEditTripMetadata,
    trip,
    clearError: () => setError(null),
  });
  const editTripTimeZoneOptions = useMemo(
    () =>
      getTimeZoneOptions({
        include: editingTripForm?.timezone ? [editingTripForm.timezone] : [],
        now: timeZoneDateFromIsoDate(editingTripForm?.startDate),
      }),
    [editingTripForm?.startDate, editingTripForm?.timezone],
  );

  const reload = useCallback(async () => {
    const next = await loadTripPlannerInitialData(tripId);
    setTrip(next.trip);
    setRole(next.role);
    setPlannerSnapshot(next.plannerSnapshot);
    setError(null);
  }, [tripId]);

  useEffect(() => {
    if (didUseInitialDataRef.current) {
      didUseInitialDataRef.current = false;
      return;
    }

    reload().catch((reason) => {
      setError(
        reason instanceof Error ? reason.message : "Failed to load places.",
      );
    });
  }, [reload]);

  async function savePlace(payload: Record<string, unknown>, id?: number) {
    if (!canEdit) return;
    try {
      setPlannerSnapshot(await savePlaceRequest(tripId, payload, id));
      setActiveCanonicalPlaceId(null);
      closeModal();
      setError(null);
    } catch (reason) {
      const message = errorMessage(reason, "Failed to save place.");
      setError(message);
      throw new Error(message);
    }
  }

  async function saveItineraryItem(
    payload: Record<string, unknown>,
    id: number,
  ) {
    if (!canEdit) return;
    try {
      setPlannerSnapshot(await saveItineraryItemRequest(tripId, payload, id));
      setEditingItem(null);
      setError(null);
    } catch (reason) {
      const message = errorMessage(reason, "Failed to save visit.");
      setError(message);
      throw new Error(message);
    }
  }

  async function deletePlace(id: number) {
    if (!canEdit) return;
    if (deletingPlaceIds.has(id)) return;

    setDeletingPlaceIds((current) => new Set(current).add(id));
    try {
      setPlannerSnapshot(await deletePlaceRequest(tripId, id));
      setActiveItemId((current) => {
        const deletedItemIds = plannerSnapshot.itineraryItems
          .filter((item) => item.place_id === id)
          .map((item) => item.id);

        return deletedItemIds.includes(current ?? -1) ? null : current;
      });
      setActiveCanonicalPlaceId((current) => (current === id ? null : current));
      setActiveSegmentId(null);
      setError(null);
    } finally {
      setDeletingPlaceIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  async function schedulePlace(
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) {
    if (!canEdit) return;
    setPlannerSnapshot(
      await schedulePlaceRequest(tripId, id, visitDate, visitTime),
    );
    setError(null);
  }

  async function createItineraryItem(
    placeId: number,
    payload: Record<string, unknown>,
  ) {
    if (!canEdit) return;
    try {
      setPlannerSnapshot(
        await createItineraryItemRequest(tripId, placeId, payload),
      );
      setAddingVisitPlace(null);
      setError(null);
    } catch (reason) {
      const message = errorMessage(reason, "Failed to add visit.");
      setError(message);
      throw new Error(message);
    }
  }

  async function scheduleItineraryItem(
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) {
    if (!canEdit) return;
    setPlannerSnapshot(
      await scheduleItineraryItemRequest(tripId, id, visitDate, visitTime),
    );
    setError(null);
  }

  async function deleteItineraryItem(id: number) {
    if (!canEdit) return;
    if (deletingItineraryItemIds.has(id)) return;

    setDeletingItineraryItemIds((current) => new Set(current).add(id));
    try {
      setPlannerSnapshot(await deleteItineraryItemRequest(tripId, id));
      setActiveItemId((current) => (current === id ? null : current));
      setActiveSegmentId(null);
      setActiveDate(null);
      setError(null);
    } finally {
      setDeletingItineraryItemIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  async function updateSegmentMode(id: number, mode: TravelMode) {
    if (!canEdit) return;
    setPlannerSnapshot(await updateSegmentModeRequest(tripId, id, mode));
    setError(null);
  }

  async function submitEditTrip(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTripForm || !canEditTripMetadata) return;

    setIsSavingTrip(true);
    setError(null);

    try {
      const updatedTrip = await updateTrip(
        tripId,
        formPayload(editingTripForm),
      );
      setTrip(updatedTrip);
      setEditingTripForm(null);
      setError(null);
    } catch (reason) {
      setError(errorMessage(reason, "Failed to update trip."));
    } finally {
      setIsSavingTrip(false);
    }
  }

  function toggleSegmentSelection(id: number | null) {
    if (id === null) {
      setActiveSegmentId(null);
      return;
    }

    setActiveDate(null);
    setActiveItemId(null);
    setActiveCanonicalPlaceId(null);
    setActiveSegmentId((current) => toggleSelectedId(current, id));
  }

  function selectItem(id: number | null) {
    setActiveDate(null);
    setActiveCanonicalPlaceId(null);
    setActiveItemId(id);
  }

  function selectCanonicalPlace(id: number | null) {
    setActiveDate(null);
    setActiveItemId(null);
    setActiveSegmentId(null);
    setActiveCanonicalPlaceId(id);
  }

  function toggleDateCollapsed(date: string) {
    setCollapsedDates((current) => toggleCollapsedDate(current, date));
  }

  function selectDate(date: string) {
    setActiveDate((current) => (current === date ? null : date));
    setActiveItemId(null);
    setActiveCanonicalPlaceId(null);
    setActiveSegmentId(null);
  }

  async function logout() {
    try {
      await logoutRequest();
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <TripPlannerView
      mobileSheetState={mobileSheetState}
      isPlannerPanelExpanded={isPlannerPanelExpanded}
      tripTitle={tripTitle}
      tripPeriodLabel={tripPeriodLabel}
      itinerary={itinerary}
      plannerSnapshot={plannerSnapshot}
      activeItemId={activeItemId}
      activeCanonicalPlaceId={activeCanonicalPlaceId}
      activeSegmentId={activeSegmentId}
      activeDate={activeDate}
      collapsedDates={collapsedDates}
      routeGeometries={routeGeometries}
      routeGeometryError={routeGeometryError}
      error={error}
      exportFeedback={exportFeedback}
      canEdit={canEdit}
      canEditTripMetadata={canEditTripMetadata}
      canAddVisits={canAddVisits}
      deletingPlaceIds={deletingPlaceIds}
      deletingItineraryItemIds={deletingItineraryItemIds}
      currentLocationPosition={currentLocationPosition}
      currentLocationToast={currentLocationToast}
      canShowCurrentLocation={canShowCurrentLocation}
      isCurrentLocationEnabled={isCurrentLocationEnabled}
      isAdding={isAdding}
      editingPlace={editingPlace}
      editingItem={editingItem}
      addingVisitPlace={addingVisitPlace}
      addPlaceVisitDate={addPlaceVisitDate}
      editingTripForm={editingTripForm}
      isSavingTrip={isSavingTrip}
      editTripTimeZoneOptions={editTripTimeZoneOptions}
      visitDateOptions={visitDateOptions}
      onTogglePlannerExpanded={() =>
        setIsPlannerPanelExpanded((value) => !value)
      }
      onMobileSheetStateChange={setMobileSheetState}
      onOpenAddModal={openAddModal}
      onOpenEditTripModal={openEditTripModal}
      onCopyMarkdownExport={copyMarkdownExport}
      onDownloadMarkdownExport={downloadMarkdownExport}
      onLogout={logout}
      onOpenAddVisitModal={openAddVisitModal}
      onOpenEditModal={openEditModal}
      onOpenEditItemModal={openEditItemModal}
      onDeletePlace={deletePlace}
      onSelectItem={selectItem}
      onSelectCanonicalPlace={selectCanonicalPlace}
      onToggleSegmentSelection={toggleSegmentSelection}
      onToggleDateCollapsed={toggleDateCollapsed}
      onSelectDate={selectDate}
      onSchedulePlace={schedulePlace}
      onScheduleItineraryItem={scheduleItineraryItem}
      onDeleteItineraryItem={deleteItineraryItem}
      onUpdateSegmentMode={updateSegmentMode}
      onToggleCurrentLocation={toggleCurrentLocation}
      onCloseModal={closeModal}
      onSavePlace={savePlace}
      onSaveItineraryItem={saveItineraryItem}
      onCreateItineraryItem={createItineraryItem}
      onSetEditingTripForm={setEditingTripForm}
      onSubmitEditTrip={submitEditTrip}
      onSetError={setError}
    />
  );
}
