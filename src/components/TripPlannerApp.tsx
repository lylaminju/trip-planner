"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouteGeometries } from "@/hooks/useRouteGeometries";
import { buildItinerary } from "@/lib/itinerary";
import type { MobileSheetState } from "@/lib/mobile-sheet";
import {
  createItineraryItemRequest,
  deleteItineraryItemRequest,
  deletePlaceRequest,
  loadPlannerSnapshot,
  logoutRequest,
  saveItineraryItemRequest,
  savePlaceRequest,
  scheduleItineraryItemRequest,
  schedulePlaceRequest,
  updateSegmentModeRequest,
} from "@/lib/planner-api";
import { toggleSelectedId } from "@/lib/selection";
import type {
  ItineraryItem,
  PlannerSnapshot,
  Place,
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
};

export function TripPlannerApp({ tripId }: TripPlannerAppProps) {
  const [snapshot, setSnapshot] = useState<PlannerSnapshot>(EMPTY_SNAPSHOT);
  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const [activeCanonicalPlaceId, setActiveCanonicalPlaceId] = useState<
    number | null
  >(null);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [isPlannerPanelExpanded, setIsPlannerPanelExpanded] = useState(false);
  const [mobileSheetState, setMobileSheetState] =
    useState<MobileSheetState>("half");
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [addingVisitPlace, setAddingVisitPlace] = useState<Place | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itinerary = useMemo(
    () =>
      buildItinerary(
        snapshot.itineraryItems,
        snapshot.routeSegments,
        snapshot.places,
      ),
    [snapshot],
  );
  const { routeGeometries, routeGeometryError } = useRouteGeometries(
    tripId,
    snapshot,
  );

  const reload = useCallback(async () => {
    setSnapshot(await loadPlannerSnapshot(tripId));
    setError(null);
  }, [tripId]);

  useEffect(() => {
    reload().catch((reason) => {
      setError(
        reason instanceof Error ? reason.message : "Failed to load places.",
      );
    });
  }, [reload]);

  async function savePlace(payload: Record<string, unknown>, id?: number) {
    try {
      setSnapshot(await savePlaceRequest(tripId, payload, id));
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
    try {
      setSnapshot(await saveItineraryItemRequest(tripId, payload, id));
      setEditingItem(null);
      setError(null);
    } catch (reason) {
      const message = errorMessage(reason, "Failed to save visit.");
      setError(message);
      throw new Error(message);
    }
  }

  async function deletePlace(id: number) {
    setSnapshot(await deletePlaceRequest(tripId, id));
    setActiveItemId((current) => {
      const deletedItemIds = snapshot.itineraryItems
        .filter((item) => item.place_id === id)
        .map((item) => item.id);

      return deletedItemIds.includes(current ?? -1) ? null : current;
    });
    setActiveCanonicalPlaceId((current) => (current === id ? null : current));
    setActiveSegmentId(null);
    setError(null);
  }

  async function schedulePlace(
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) {
    setSnapshot(await schedulePlaceRequest(tripId, id, visitDate, visitTime));
    setError(null);
  }

  async function createItineraryItem(
    placeId: number,
    payload: Record<string, unknown>,
  ) {
    try {
      setSnapshot(await createItineraryItemRequest(tripId, placeId, payload));
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
    setSnapshot(
      await scheduleItineraryItemRequest(tripId, id, visitDate, visitTime),
    );
    setError(null);
  }

  async function deleteItineraryItem(id: number) {
    setSnapshot(await deleteItineraryItemRequest(tripId, id));
    setActiveItemId((current) => (current === id ? null : current));
    setActiveSegmentId(null);
    setActiveDate(null);
    setError(null);
  }

  async function updateSegmentMode(id: number, mode: TravelMode) {
    setSnapshot(await updateSegmentModeRequest(tripId, id, mode));
    setError(null);
  }

  function openAddModal() {
    setError(null);
    setEditingPlace(null);
    setEditingItem(null);
    setAddingVisitPlace(null);
    setIsAdding(true);
  }

  function openEditModal(place: Place) {
    setError(null);
    setEditingPlace(place);
    setEditingItem(null);
    setAddingVisitPlace(null);
    setIsAdding(true);
  }

  function openEditItemModal(item: ItineraryItem) {
    setError(null);
    setEditingPlace(null);
    setEditingItem(item);
    setAddingVisitPlace(null);
    setIsAdding(false);
  }

  function openAddVisitModal(place: Place) {
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

  async function logout() {
    try {
      await logoutRequest();
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <main
      className={`app-shell mobile-sheet-${mobileSheetState} ${
        isPlannerPanelExpanded ? "left-panel-expanded" : ""
      }`}
    >
      <PlannerPanel
        itinerary={itinerary}
        places={snapshot.places}
        activePlaceId={activeItemId}
        activeCanonicalPlaceId={activeCanonicalPlaceId}
        activeSegmentId={activeSegmentId}
        activeDate={activeDate}
        routeGeometries={routeGeometries}
        error={error}
        isExpanded={isPlannerPanelExpanded}
        mobileSheetState={mobileSheetState}
        onToggleExpanded={() => setIsPlannerPanelExpanded((value) => !value)}
        onMobileSheetStateChange={setMobileSheetState}
        onAdd={openAddModal}
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
        routeSegments={snapshot.routeSegments}
        activePlaceId={activeItemId}
        activeCanonicalPlaceId={activeCanonicalPlaceId}
        activeSegmentId={activeSegmentId}
        activeDate={activeDate}
        mobileSheetState={mobileSheetState}
        routeGeometries={routeGeometries}
        routeGeometryError={routeGeometryError}
        hidden={isPlannerPanelExpanded}
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
