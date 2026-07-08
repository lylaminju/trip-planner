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
import { useTripPlannerMutations } from "@/hooks/useTripPlannerMutations";
import { useTripPlannerModals } from "@/hooks/useTripPlannerModals";
import { useTripPlannerSelection } from "@/hooks/useTripPlannerSelection";
import { isAiPlanningDestinationSupported } from "@/lib/ai-planning";
import { toggleCollapsedDate } from "@/lib/date-collapse";
import { errorMessage } from "@/lib/error-message";
import { buildVisitDateOptions } from "@/lib/itinerary";
import type { MobileSheetState } from "@/lib/mobile-sheet";
import {
  generateAiItinerary,
  loadAiPlanningSetup,
  loadTripPlannerInitialData,
} from "@/lib/planner-api";
import { SERVICE_TITLE } from "@/lib/service-brand";
import { isTripOngoing } from "@/lib/trip-classification";
import { formatTripPeriodLabel } from "@/lib/trip-period-label";
import { updateTrip } from "@/lib/trips-api";
import type {
  AiPlanningGenerationInput,
  AiPlanningSetup,
  PlannerSnapshot,
  Trip,
  TripPlannerInitialData,
  TripRole,
} from "@/lib/types";

import {
  buildItineraryForTrip,
  formPayload,
  toTripDateRange,
} from "./trip-planner-app-utils";
import { TripPlannerView } from "./TripPlannerView";

const EMPTY_SNAPSHOT: PlannerSnapshot = {
  places: [],
  itineraryItems: [],
  routeSegments: [],
};

type AiPlanningWizardState = {
  isOpen: boolean;
  isLoading: boolean;
  isGenerating: boolean;
  setup: AiPlanningSetup | null;
  error: string | null;
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
  const selection = useTripPlannerSelection();
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(
    () => new Set(),
  );
  const [isPlannerPanelExpanded, setIsPlannerPanelExpanded] = useState(false);
  const [mobileSheetState, setMobileSheetState] =
    useState<MobileSheetState>("half");
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPlanningWizard, setAiPlanningWizard] =
    useState<AiPlanningWizardState>({
      isOpen: false,
      isLoading: false,
      isGenerating: false,
      setup: null,
      error: null,
    });

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
  const canPlanWithAi =
    canEditTripMetadata &&
    isAiPlanningDestinationSupported(trip?.destination_slug) &&
    hasAiPlanningDateRange(trip);
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
  const plannerMutations = useTripPlannerMutations({
    tripId,
    canEdit,
    plannerSnapshot,
    setPlannerSnapshot,
    setError,
    closeModal,
    setAddingVisitPlace,
    setEditingItem,
    clearActiveCanonicalPlace: selection.clearActiveCanonicalPlace,
    clearDeletedPlaceSelection: selection.clearDeletedPlaceSelection,
    clearDeletedItineraryItemSelection:
      selection.clearDeletedItineraryItemSelection,
  });
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

  function toggleDateCollapsed(date: string) {
    setCollapsedDates((current) => toggleCollapsedDate(current, date));
  }

  async function openAiPlanningSetup() {
    if (!canPlanWithAi) return;

    setAiPlanningWizard({
      isOpen: true,
      isLoading: true,
      isGenerating: false,
      setup: null,
      error: null,
    });

    try {
      const setup = await loadAiPlanningSetup(tripId);
      setAiPlanningWizard({
        isOpen: true,
        isLoading: false,
        isGenerating: false,
        setup,
        error: null,
      });
    } catch (reason) {
      setAiPlanningWizard({
        isOpen: true,
        isLoading: false,
        isGenerating: false,
        setup: null,
        error: errorMessage(reason, "Failed to load AI planning setup."),
      });
    }
  }

  function closeAiPlanningWizard() {
    setAiPlanningWizard((current) => ({
      ...current,
      isOpen: false,
      isLoading: false,
      isGenerating: false,
      error: null,
    }));
  }

  async function createAiItineraryFromWizard(
    input: AiPlanningGenerationInput,
  ) {
    setAiPlanningWizard((current) => ({
      ...current,
      isGenerating: true,
      error: null,
    }));

    try {
      const result = await generateAiItinerary(tripId, input);
      setPlannerSnapshot(result.plannerSnapshot);
      setAiPlanningWizard((current) => ({
        ...current,
        isOpen: false,
        isGenerating: false,
        error: null,
      }));
      setError(null);
    } catch (reason) {
      setAiPlanningWizard((current) => ({
        ...current,
        isGenerating: false,
        error: errorMessage(
          reason,
          "Failed to generate AI itinerary.",
        ),
      }));
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
      activeItemId={selection.activeItemId}
      activeCanonicalPlaceId={selection.activeCanonicalPlaceId}
      activeSegmentId={selection.activeSegmentId}
      activeDate={selection.activeDate}
      collapsedDates={collapsedDates}
      routeGeometries={routeGeometries}
      routeGeometryError={routeGeometryError}
      error={error}
      exportFeedback={exportFeedback}
      canEdit={canEdit}
      canEditTripMetadata={canEditTripMetadata}
      canAddVisits={canAddVisits}
      deletingPlaceIds={plannerMutations.deletingPlaceIds}
      deletingItineraryItemIds={plannerMutations.deletingItineraryItemIds}
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
      aiPlanningWizard={aiPlanningWizard}
      visitDateOptions={visitDateOptions}
      onTogglePlannerExpanded={() =>
        setIsPlannerPanelExpanded((value) => !value)
      }
      onPlanWithAi={canPlanWithAi ? openAiPlanningSetup : undefined}
      onMobileSheetStateChange={setMobileSheetState}
      onOpenAddModal={openAddModal}
      onOpenEditTripModal={openEditTripModal}
      onCopyMarkdownExport={copyMarkdownExport}
      onDownloadMarkdownExport={downloadMarkdownExport}
      onOpenAddVisitModal={openAddVisitModal}
      onOpenEditModal={openEditModal}
      onOpenEditItemModal={openEditItemModal}
      onDeletePlace={plannerMutations.deletePlace}
      onSelectItem={selection.selectItem}
      onSelectCanonicalPlace={selection.selectCanonicalPlace}
      onToggleSegmentSelection={selection.toggleSegmentSelection}
      onToggleDateCollapsed={toggleDateCollapsed}
      onSelectDate={selection.selectDate}
      onSchedulePlace={plannerMutations.schedulePlace}
      onScheduleItineraryItem={plannerMutations.scheduleItineraryItem}
      onDeleteItineraryItem={plannerMutations.deleteItineraryItem}
      onUpdateSegmentMode={plannerMutations.updateSegmentMode}
      onToggleCurrentLocation={toggleCurrentLocation}
      onCloseModal={closeModal}
      onSavePlace={plannerMutations.savePlace}
      onSaveItineraryItem={plannerMutations.saveItineraryItem}
      onCreateItineraryItem={plannerMutations.createItineraryItem}
      onSetEditingTripForm={setEditingTripForm}
      onSubmitEditTrip={submitEditTrip}
      onSetError={setError}
      onCloseAiPlanningWizard={closeAiPlanningWizard}
      onCreateAiItinerary={createAiItineraryFromWizard}
    />
  );
}

function hasAiPlanningDateRange(trip: Trip | null): boolean {
  if (!trip?.start_date || !trip.end_date) {
    return false;
  }

  return (
    isValidIsoDate(trip.start_date) &&
    isValidIsoDate(trip.end_date) &&
    trip.start_date <= trip.end_date
  );
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
