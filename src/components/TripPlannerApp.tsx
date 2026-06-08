"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRouteGeometries } from "@/hooks/useRouteGeometries";
import {
  startCurrentLocationWatch,
  type CurrentLocationPosition,
} from "@/lib/current-location";
import { toggleCollapsedDate } from "@/lib/date-collapse";
import { buildItinerary } from "@/lib/itinerary";
import {
  buildExportFilename,
  generateScheduledItineraryMarkdown,
} from "@/lib/itinerary-markdown";
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
import { isTripOngoing } from "@/lib/trip-classification";
import type {
  ItineraryItem,
  PlannerSnapshot,
  Place,
  Trip,
  TripPlannerInitialData,
  TripRole,
  TravelMode,
} from "@/lib/types";

import { AddEditPlaceModal } from "./AddEditPlaceModal";
import { EditItineraryItemModal } from "./EditItineraryItemModal";
import { MapPanel } from "./MapPanel";
import { PlannerPanel } from "./PlannerPanel";

const EMPTY_SNAPSHOT: PlannerSnapshot = {
  places: [],
  itineraryItems: [],
  routeSegments: [],
};

type TripPlannerAppProps = {
  tripId: number;
  initialData?: TripPlannerInitialData;
};

export function TripPlannerApp({
  tripId,
  initialData,
}: TripPlannerAppProps) {
  const [trip, setTrip] = useState<Trip | null>(() => initialData?.trip ?? null);
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
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [addingVisitPlace, setAddingVisitPlace] = useState<Place | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingPlaceIds, setDeletingPlaceIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [deletingItineraryItemIds, setDeletingItineraryItemIds] = useState<
    Set<number>
  >(() => new Set());
  const [exportFeedback, setExportFeedback] = useState<{
    action: "copy" | "download";
    kind: "error" | "success";
    label: string;
  } | null>(null);
  const [isCurrentLocationEnabled, setIsCurrentLocationEnabled] =
    useState(false);
  const [currentLocationPosition, setCurrentLocationPosition] =
    useState<CurrentLocationPosition | null>(null);
  const [currentLocationToast, setCurrentLocationToast] = useState<
    string | null
  >(null);
  const currentLocationStopRef = useRef<(() => void) | null>(null);
  const currentLocationToastTimeoutRef = useRef<number | null>(null);

  const itinerary = useMemo(
    () =>
      buildItinerary(
        plannerSnapshot.itineraryItems,
        plannerSnapshot.routeSegments,
        plannerSnapshot.places,
      ),
    [plannerSnapshot],
  );
  const { routeGeometries, routeGeometryError } = useRouteGeometries(
    tripId,
    plannerSnapshot,
  );
  const canEdit = role !== "viewer";
  const tripTitle = trip?.name ?? "Trip Planner";
  const canShowCurrentLocation = trip ? isTripOngoing(trip) : false;

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

  useEffect(() => {
    if (!exportFeedback) return;

    const timeout = window.setTimeout(
      () => setExportFeedback(null),
      exportFeedback.kind === "error" ? 3500 : 2000,
    );

    return () => window.clearTimeout(timeout);
  }, [exportFeedback]);

  useEffect(() => {
    if (canShowCurrentLocation) {
      return;
    }

    stopCurrentLocationWatch();
    clearCurrentLocationToast();
  }, [canShowCurrentLocation]);

  useEffect(() => {
    return () => {
      currentLocationStopRef.current?.();
      if (currentLocationToastTimeoutRef.current !== null) {
        window.clearTimeout(currentLocationToastTimeoutRef.current);
      }
    };
  }, []);

  async function savePlace(payload: Record<string, unknown>, id?: number) {
    if (!canEdit) return;
    try {
      setPlannerSnapshot(await savePlaceRequest(tripId, payload, id));
      setActiveCanonicalPlaceId(null);
      setIsAdding(false);
      setEditingPlace(null);
      setEditingItem(null);
      setAddingVisitPlace(null);
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

  function openAddModal() {
    if (!canEdit) return;
    setError(null);
    setEditingPlace(null);
    setEditingItem(null);
    setAddingVisitPlace(null);
    setIsAdding(true);
  }

  function openEditModal(place: Place) {
    if (!canEdit) return;
    setError(null);
    setEditingPlace(place);
    setEditingItem(null);
    setAddingVisitPlace(null);
    setIsAdding(true);
  }

  function openEditItemModal(item: ItineraryItem) {
    if (!canEdit) return;
    setError(null);
    setEditingPlace(null);
    setEditingItem(item);
    setAddingVisitPlace(null);
    setIsAdding(false);
  }

  function openAddVisitModal(place: Place) {
    if (!canEdit) return;
    setError(null);
    setEditingPlace(null);
    setEditingItem(null);
    setAddingVisitPlace(place);
    setIsAdding(false);
  }

  function closeModal() {
    setIsAdding(false);
    setEditingPlace(null);
    setEditingItem(null);
    setAddingVisitPlace(null);
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

  async function logout() {
    try {
      await logoutRequest();
    } finally {
      window.location.assign("/");
    }
  }

  async function copyMarkdownExport() {
    const markdown = generateScheduledItineraryMarkdown(tripTitle, itinerary);

    try {
      await navigator.clipboard.writeText(markdown);
      setExportFeedback({ action: "copy", kind: "success", label: "Copied" });
    } catch {
      setExportFeedback({
        action: "copy",
        kind: "error",
        label: "Copy failed",
      });
    }
  }

  function downloadMarkdownExport() {
    const markdown = generateScheduledItineraryMarkdown(tripTitle, itinerary);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = buildExportFilename(tripTitle);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExportFeedback({
      action: "download",
      kind: "success",
      label: "Downloaded",
    });
  }

  function clearCurrentLocationToast() {
    if (currentLocationToastTimeoutRef.current !== null) {
      window.clearTimeout(currentLocationToastTimeoutRef.current);
      currentLocationToastTimeoutRef.current = null;
    }
    setCurrentLocationToast(null);
  }

  function showCurrentLocationToast(message: string) {
    clearCurrentLocationToast();
    setCurrentLocationToast(message);
    currentLocationToastTimeoutRef.current = window.setTimeout(() => {
      setCurrentLocationToast(null);
      currentLocationToastTimeoutRef.current = null;
    }, 3500);
  }

  function stopCurrentLocationWatch() {
    currentLocationStopRef.current?.();
    currentLocationStopRef.current = null;
    setIsCurrentLocationEnabled(false);
    setCurrentLocationPosition(null);
  }

  function toggleCurrentLocation() {
    if (isCurrentLocationEnabled) {
      stopCurrentLocationWatch();
      clearCurrentLocationToast();
      return;
    }

    clearCurrentLocationToast();

    if (!canShowCurrentLocation) {
      return;
    }

    if (!navigator.geolocation) {
      showCurrentLocationToast("Location is not supported by this browser.");
      return;
    }

    try {
      currentLocationStopRef.current = startCurrentLocationWatch(
        navigator.geolocation,
        (position) => {
          setCurrentLocationPosition(position);
          setIsCurrentLocationEnabled(true);
          clearCurrentLocationToast();
        },
        (reason) => {
          stopCurrentLocationWatch();
          showCurrentLocationToast(currentLocationErrorMessage(reason));
        },
      );
      setIsCurrentLocationEnabled(true);
    } catch (reason) {
      stopCurrentLocationWatch();
      showCurrentLocationToast(currentLocationErrorMessage(reason));
    }
  }

  return (
    <main
      className={`app-shell mobile-sheet-${mobileSheetState} ${
        isPlannerPanelExpanded ? "left-panel-expanded" : ""
      }`}
    >
      <PlannerPanel
        title={tripTitle}
        itinerary={itinerary}
        places={plannerSnapshot.places}
        activePlaceId={activeItemId}
        activeCanonicalPlaceId={activeCanonicalPlaceId}
        activeSegmentId={activeSegmentId}
        activeDate={activeDate}
        collapsedDates={collapsedDates}
        routeGeometries={routeGeometries}
        error={error}
        currentLocationToast={currentLocationToast}
        exportFeedback={exportFeedback}
        isExpanded={isPlannerPanelExpanded}
        mobileSheetState={mobileSheetState}
        canEdit={canEdit}
        deletingPlaceIds={deletingPlaceIds}
        deletingItineraryItemIds={deletingItineraryItemIds}
        canShowCurrentLocation={canShowCurrentLocation}
        isCurrentLocationActive={isCurrentLocationEnabled}
        onToggleExpanded={() => setIsPlannerPanelExpanded((value) => !value)}
        onMobileSheetStateChange={setMobileSheetState}
        onToggleCurrentLocation={toggleCurrentLocation}
        onAdd={openAddModal}
        onCopyExport={() => {
          copyMarkdownExport().catch(() => {
            setExportFeedback({
              action: "copy",
              kind: "error",
              label: "Copy failed",
            });
          });
        }}
        onDownloadExport={downloadMarkdownExport}
        onLogout={logout}
        onAddVisit={openAddVisitModal}
        onEdit={openEditModal}
        onEditItem={openEditItemModal}
        onDelete={(id) =>
          deletePlace(id).catch((reason) => {
            setError(
              reason instanceof Error
                ? reason.message
                : "Failed to delete place.",
            );
          })
        }
        onSelectPlace={selectItem}
        onSelectCanonicalPlace={selectCanonicalPlace}
        onSelectSegment={toggleSegmentSelection}
        onToggleDateCollapsed={toggleDateCollapsed}
        onSelectDate={(date) => {
          setActiveDate((current) => (current === date ? null : date));
          setActiveItemId(null);
          setActiveCanonicalPlaceId(null);
          setActiveSegmentId(null);
        }}
        onSchedulePlace={(id, date, time) =>
          schedulePlace(id, date, time).catch((reason) => {
            setError(
              reason instanceof Error
                ? reason.message
                : "Failed to schedule place.",
            );
          })
        }
        onScheduleItem={(id, date, time) =>
          scheduleItineraryItem(id, date, time).catch((reason) => {
            setError(
              reason instanceof Error
                ? reason.message
                : "Failed to schedule itinerary item.",
            );
          })
        }
        onDeleteItem={(id) =>
          deleteItineraryItem(id).catch((reason) => {
            setError(
              reason instanceof Error
                ? reason.message
                : "Failed to delete itinerary item.",
            );
          })
        }
        onModeChange={(id, mode) =>
          updateSegmentMode(id, mode).catch((reason) => {
            setError(
              reason instanceof Error
                ? reason.message
                : "Failed to update route mode.",
            );
          })
        }
      />
      <MapPanel
        itinerary={itinerary}
        routeSegments={plannerSnapshot.routeSegments}
        activePlaceId={activeItemId}
        activeCanonicalPlaceId={activeCanonicalPlaceId}
        activeSegmentId={activeSegmentId}
        activeDate={activeDate}
        mobileSheetState={mobileSheetState}
        routeGeometries={routeGeometries}
        routeGeometryError={routeGeometryError}
        currentLocationPosition={currentLocationPosition}
        hidden={isPlannerPanelExpanded}
        canEdit={canEdit}
        onAddPlace={openAddModal}
        onSelectPlace={selectItem}
        onSelectSegment={toggleSegmentSelection}
      />
      {(isAdding || editingPlace) && (
        <AddEditPlaceModal
          place={editingPlace}
          onCancel={closeModal}
          onSave={(payload) => savePlace(payload, editingPlace?.id)}
        />
      )}
      {editingItem && (
        <EditItineraryItemModal
          item={editingItem}
          onCancel={closeModal}
          onSave={(payload) => saveItineraryItem(payload, editingItem.id)}
        />
      )}
      {addingVisitPlace && (
        <EditItineraryItemModal
          place={addingVisitPlace}
          onCancel={closeModal}
          onSave={(payload) =>
            createItineraryItem(addingVisitPlace.id, payload)
          }
        />
      )}
    </main>
  );
}

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

function currentLocationErrorMessage(reason: unknown): string {
  if (isGeolocationPermissionDenied(reason)) {
    return "Location permission denied.";
  }

  return "Unable to access current location.";
}

function isGeolocationPermissionDenied(reason: unknown): boolean {
  return (
    typeof reason === "object" &&
    reason !== null &&
    "code" in reason &&
    reason.code === 1
  );
}
