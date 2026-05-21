"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildItinerary } from "@/lib/itinerary";
import { toggleSelectedId } from "@/lib/selection";
import type {
  ItineraryItem,
  PlannerSnapshot,
  Place,
  RouteGeometry,
  TravelMode,
} from "@/lib/types";

import { AddEditPlaceModal } from "./AddEditPlaceModal";
import { EditItineraryItemModal } from "./EditItineraryItemModal";
import { LeftPanel } from "./LeftPanel";
import { MapPanel } from "./MapPanel";

const EMPTY_SNAPSHOT: PlannerSnapshot = {
  places: [],
  itineraryItems: [],
  routeSegments: [],
};

export function TripPlannerApp() {
  const [snapshot, setSnapshot] = useState<PlannerSnapshot>(EMPTY_SNAPSHOT);
  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const [activeCanonicalPlaceId, setActiveCanonicalPlaceId] = useState<
    number | null
  >(null);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [isLeftPanelExpanded, setIsLeftPanelExpanded] = useState(false);
  const [mobileSheetState, setMobileSheetState] =
    useState<MobileSheetState>("half");
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [addingVisitPlace, setAddingVisitPlace] = useState<Place | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeGeometries, setRouteGeometries] = useState<
    Map<number, RouteGeometry>
  >(new Map());
  const [routeGeometryError, setRouteGeometryError] = useState<string | null>(
    null,
  );
  const routeGeometrySignaturesRef = useRef<Map<number, string>>(new Map());

  const itinerary = useMemo(
    () =>
      buildItinerary(
        snapshot.itineraryItems,
        snapshot.routeSegments,
        snapshot.places,
      ),
    [snapshot],
  );
  const routeGeometrySignature = useMemo(
    () =>
      buildRouteGeometrySignature(
        snapshot.routeSegments,
        snapshot.itineraryItems,
      ),
    [snapshot.routeSegments, snapshot.itineraryItems],
  );

  useEffect(() => {
    let cancelled = false;
    const itemsById = new Map(
      snapshot.itineraryItems.map((item) => [item.id, item]),
    );
    const nextSignatures = new Map(
      snapshot.routeSegments.map((segment) => [
        segment.id,
        routeGeometryRequestSignature(segment, itemsById),
      ]),
    );
    const nextSegmentIds = new Set(nextSignatures.keys());
    const staleSegmentIds = new Set(
      snapshot.routeSegments
        .filter(
          (segment) =>
            routeGeometrySignaturesRef.current.get(segment.id) !==
            nextSignatures.get(segment.id),
        )
        .map((segment) => segment.id),
    );

    setRouteGeometries((current) => {
      const next = new Map(current);
      let changed = false;
      for (const segmentId of current.keys()) {
        if (!nextSegmentIds.has(segmentId) || staleSegmentIds.has(segmentId)) {
          next.delete(segmentId);
          changed = true;
        }
      }
      return changed ? next : current;
    });

    if (snapshot.routeSegments.length === 0) {
      routeGeometrySignaturesRef.current.clear();
      setRouteGeometryError(null);
      return;
    }

    const missingSegmentIds = snapshot.routeSegments
      .map((segment) => segment.id)
      .filter(
        (segmentId) =>
          staleSegmentIds.has(segmentId) || !routeGeometries.has(segmentId),
      );

    if (missingSegmentIds.length === 0) {
      routeGeometrySignaturesRef.current = nextSignatures;
      return;
    }

    routeGeometrySignaturesRef.current = nextSignatures;

    void Promise.all(missingSegmentIds.map(fetchRouteGeometry)).then(
      (results) => {
        if (cancelled) return;

        setRouteGeometryError(
          results.find((result) => result.error)?.error ?? null,
        );
        setRouteGeometries((current) => {
          const next = new Map(current);
          let changed = false;

          for (const { geometry } of results) {
            if (!geometry) continue;
            next.set(geometry.segment_id, geometry);
            changed = true;
          }

          return changed ? next : current;
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [routeGeometrySignature, routeGeometries, snapshot.routeSegments]);

  const reload = useCallback(async () => {
    const response = await fetch("/api/places");
    if (!response.ok) {
      throw new Error("Failed to load places.");
    }

    setSnapshot(await response.json());
    setError(null);
  }, []);

  useEffect(() => {
    reload().catch((reason) => {
      setError(
        reason instanceof Error ? reason.message : "Failed to load places.",
      );
    });
  }, [reload]);

  async function savePlace(payload: Record<string, unknown>, id?: number) {
    const response = await fetch(id ? `/api/places/${id}` : "/api/places", {
      method: id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      const message =
        typeof data?.error === "string" ? data.error : "Failed to save place.";
      setError(message);
      throw new Error(message);
    }

    setSnapshot(data);
    setActiveCanonicalPlaceId(null);
    setIsAdding(false);
    setEditingPlace(null);
    setEditingItem(null);
    setAddingVisitPlace(null);
    setError(null);
  }

  async function saveItineraryItem(
    payload: Record<string, unknown>,
    id: number,
  ) {
    const response = await fetch(`/api/itinerary-items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      const message =
        typeof data?.error === "string" ? data.error : "Failed to save visit.";
      setError(message);
      throw new Error(message);
    }

    setSnapshot(data);
    setEditingItem(null);
    setError(null);
  }

  async function deletePlace(id: number) {
    const response = await fetch(`/api/places/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        typeof data?.error === "string"
          ? data.error
          : "Failed to delete place.",
      );
    }

    setSnapshot(data);
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
    const response = await fetch(`/api/places/${id}/schedule`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visit_date: visitDate, visit_time: visitTime }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        typeof data?.error === "string"
          ? data.error
          : "Failed to schedule place.",
      );
    }

    setSnapshot(data);
    setError(null);
  }

  async function createItineraryItem(
    placeId: number,
    payload: Record<string, unknown>,
  ) {
    const response = await fetch(`/api/places/${placeId}/schedule`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      const message =
        typeof data?.error === "string" ? data.error : "Failed to add visit.";
      setError(message);
      throw new Error(message);
    }

    setSnapshot(data);
    setAddingVisitPlace(null);
    setError(null);
  }

  async function scheduleItineraryItem(
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) {
    const response = await fetch(`/api/itinerary-items/${id}/schedule`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visit_date: visitDate, visit_time: visitTime }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        typeof data?.error === "string"
          ? data.error
          : "Failed to schedule itinerary item.",
      );
    }

    setSnapshot(data);
    setError(null);
  }

  async function deleteItineraryItem(id: number) {
    const response = await fetch(`/api/itinerary-items/${id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        typeof data?.error === "string"
          ? data.error
          : "Failed to delete itinerary item.",
      );
    }

    setSnapshot(data);
    setActiveItemId((current) => (current === id ? null : current));
    setActiveSegmentId(null);
    setActiveDate(null);
    setError(null);
  }

  async function updateSegmentMode(id: number, mode: TravelMode) {
    const response = await fetch(`/api/route-segments/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        typeof data?.error === "string"
          ? data.error
          : "Failed to update route mode.",
      );
    }

    setSnapshot(data);
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

  return (
    <main
      className={`app-shell mobile-sheet-${mobileSheetState} ${
        isLeftPanelExpanded ? "left-panel-expanded" : ""
      }`}
    >
      <LeftPanel
        itinerary={itinerary}
        places={snapshot.places}
        activePlaceId={activeItemId}
        activeCanonicalPlaceId={activeCanonicalPlaceId}
        activeSegmentId={activeSegmentId}
        activeDate={activeDate}
        routeGeometries={routeGeometries}
        error={error}
        isExpanded={isLeftPanelExpanded}
        mobileSheetState={mobileSheetState}
        onToggleExpanded={() => setIsLeftPanelExpanded((value) => !value)}
        onMobileSheetStateChange={setMobileSheetState}
        onAdd={openAddModal}
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
        routeGeometries={routeGeometries}
        routeGeometryError={routeGeometryError}
        hidden={isLeftPanelExpanded}
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

type RouteGeometryFetchResult = {
  geometry: RouteGeometry | null;
  error: string | null;
};

type MobileSheetState = "collapsed" | "half" | "full";

async function fetchRouteGeometry(
  segmentId: number,
): Promise<RouteGeometryFetchResult> {
  try {
    const response = await fetch(`/api/route-segments/${segmentId}/geometry`);
    if (!response.ok) {
      return {
        geometry: null,
        error:
          response.status === 503
            ? "Real routes need a server-side Google Routes API key. Showing straight lines for now."
            : "Real routes are unavailable from Google right now. Showing straight lines for now.",
      };
    }

    const geometry = (await response.json()) as RouteGeometry;
    return {
      geometry: geometry.segment_id === segmentId ? geometry : null,
      error: null,
    };
  } catch {
    return {
      geometry: null,
      error:
        "Real routes are unavailable from Google right now. Showing straight lines for now.",
    };
  }
}

function buildRouteGeometrySignature(
  routeSegments: PlannerSnapshot["routeSegments"],
  items: PlannerSnapshot["itineraryItems"],
): string {
  const itemsById = new Map(items.map((item) => [item.id, item]));

  return routeSegments
    .map((segment) => routeGeometryRequestSignature(segment, itemsById))
    .join(";");
}

function routeGeometryRequestSignature(
  segment: PlannerSnapshot["routeSegments"][number],
  itemsById: Map<number, ItineraryItem>,
): string {
  const from = itemsById.get(segment.from_item_id);
  const to = itemsById.get(segment.to_item_id);
  return [
    segment.id,
    segment.mode,
    from?.place.latitude ?? "",
    from?.place.longitude ?? "",
    to?.place.latitude ?? "",
    to?.place.longitude ?? "",
  ].join(":");
}
