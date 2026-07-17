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
import {
  AI_OPENING_HOURS_WARNING,
  isAiPlanningDestinationSupported,
} from "@/lib/ai-planning";
import { toggleCollapsedDate } from "@/lib/date-collapse";
import { findDestinationFocus } from "@/lib/destination-options";
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
import { tripDurationDays } from "@/lib/trip-day-metrics";
import { formatTripPeriodLabel } from "@/lib/trip-period-label";
import { updateTrip } from "@/lib/trips-api";
import type {
  AiPlanningGenerationInput,
  AiPlanningSetup,
  PlannerSnapshot,
  Trip,
  TripMemberSummary,
  TripPlannerInitialData,
  TripRole,
} from "@/lib/types";

import {
  buildItineraryForTrip,
  formPayload,
  toTripDateRange,
} from "./trip-planner-app-utils";
import { TripMembersModal } from "./TripMembersModal";
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
  currentUserId: string;
  initialData?: TripPlannerInitialData;
};

export function TripPlannerApp({
  tripId,
  currentUserId,
  initialData,
}: TripPlannerAppProps) {
  const [trip, setTrip] = useState<Trip | null>(
    () => initialData?.trip ?? null,
  );
  const [role, setRole] = useState<TripRole>(
    () => initialData?.role ?? "viewer",
  );
  const [members, setMembers] = useState<TripMemberSummary[]>(
    () => initialData?.members ?? [],
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
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editTripError, setEditTripError] = useState<string | null>(null);
  const [aiPlanningWizard, setAiPlanningWizard] =
    useState<AiPlanningWizardState>({
      isOpen: false,
      isLoading: false,
      isGenerating: false,
      setup: null,
      error: null,
    });
  const [aiGenerationToast, setAiGenerationToast] = useState<string | null>(
    null,
  );

  const itinerary = useMemo(
    () => buildItineraryForTrip(plannerSnapshot, trip),
    [plannerSnapshot, trip],
  );
  const destinationFocus = useMemo(
    () => findDestinationFocus(trip?.destination_slug ?? trip?.destination),
    [trip?.destination_slug, trip?.destination],
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
  const tripDays = trip ? tripDurationDays(trip) : null;
  const tripMetaLabel =
    [
      tripPeriodLabel,
      tripDays ? `${tripDays} ${tripDays === 1 ? "day" : "days"}` : null,
      trip?.destination?.trim() || null,
    ]
      .filter(Boolean)
      .join(" · ") || null;
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
    clearError: () => {
      setError(null);
      setEditTripError(null);
    },
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
    setMembers(next.members);
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
    setEditTripError(null);

    try {
      const updatedTrip = await updateTrip(
        tripId,
        formPayload(editingTripForm),
      );
      setTrip(updatedTrip);
      setEditingTripForm(null);
      setEditTripError(null);
    } catch (reason) {
      setEditTripError(errorMessage(reason, "Failed to update trip."));
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

  async function createAiItineraryFromWizard(input: AiPlanningGenerationInput) {
    setAiPlanningWizard((current) => ({
      ...current,
      isGenerating: true,
      error: null,
    }));
    setAiGenerationToast(null);

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
      setAiGenerationToast(AI_OPENING_HOURS_WARNING);
    } catch (reason) {
      setAiPlanningWizard((current) => ({
        ...current,
        isGenerating: false,
        error: errorMessage(reason, "Failed to generate AI itinerary."),
      }));
    }
  }

  return (
    <>
      {isMembersModalOpen && trip && (
        <TripMembersModal
          tripId={tripId}
          tripName={tripTitle}
          destination={trip.destination}
          destinationSlug={trip.destination_slug}
          members={members}
          currentUserId={currentUserId}
          onClose={() => setIsMembersModalOpen(false)}
          onMembersChange={setMembers}
        />
      )}
      <TripPlannerView
        mobileSheetState={mobileSheetState}
        isPlannerPanelExpanded={isPlannerPanelExpanded}
        tripTitle={tripTitle}
        tripPeriodLabel={tripMetaLabel}
        members={members}
        currentUserId={currentUserId}
        destinationFocus={destinationFocus}
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
        aiGenerationToast={aiGenerationToast}
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
        editTripError={editTripError}
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
        onManageMembers={
          canEditTripMetadata ? () => setIsMembersModalOpen(true) : undefined
        }
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
        onClearSelection={selection.clearSelection}
        onSchedulePlace={plannerMutations.schedulePlace}
        onScheduleItineraryItem={plannerMutations.scheduleItineraryItem}
        onDeleteItineraryItem={plannerMutations.deleteItineraryItem}
        onUpdateSegmentMode={plannerMutations.updateSegmentMode}
        onToggleCurrentLocation={toggleCurrentLocation}
        onCloseModal={closeModal}
        onResolvePlaceUrl={plannerMutations.resolvePlace}
        onSavePlace={plannerMutations.savePlace}
        onSaveItineraryItem={plannerMutations.saveItineraryItem}
        onCreateItineraryItem={plannerMutations.createItineraryItem}
        onSetEditingTripForm={setEditingTripForm}
        onSubmitEditTrip={submitEditTrip}
        onSetError={setError}
        onCloseAiPlanningWizard={closeAiPlanningWizard}
        onCreateAiItinerary={createAiItineraryFromWizard}
      />
    </>
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
