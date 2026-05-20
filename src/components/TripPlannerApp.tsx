"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { buildItinerary } from "@/lib/itinerary";
import { toggleSelectedId } from "@/lib/selection";
import type { PlannerSnapshot, Place, TravelMode } from "@/lib/types";

import { AddEditPlaceModal } from "./AddEditPlaceModal";
import { LeftPanel } from "./LeftPanel";
import { MapPanel } from "./MapPanel";

const EMPTY_SNAPSHOT: PlannerSnapshot = { places: [], routeSegments: [] };

export function TripPlannerApp() {
  const [snapshot, setSnapshot] = useState<PlannerSnapshot>(EMPTY_SNAPSHOT);
  const [activePlaceId, setActivePlaceId] = useState<number | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itinerary = useMemo(() => buildItinerary(snapshot.places, snapshot.routeSegments), [snapshot]);

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
      setError(reason instanceof Error ? reason.message : "Failed to load places.");
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
      const message = typeof data?.error === "string" ? data.error : "Failed to save place.";
      setError(message);
      throw new Error(message);
    }

    setSnapshot(data);
    setIsAdding(false);
    setEditingPlace(null);
    setError(null);
  }

  async function deletePlace(id: number) {
    const response = await fetch(`/api/places/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(typeof data?.error === "string" ? data.error : "Failed to delete place.");
    }

    setSnapshot(data);
    setActivePlaceId((current) => (current === id ? null : current));
    setActiveSegmentId(null);
    setError(null);
  }

  async function schedulePlace(id: number, visitDate: string | null, visitTime: string | null) {
    const response = await fetch(`/api/places/${id}/schedule`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visit_date: visitDate, visit_time: visitTime }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(typeof data?.error === "string" ? data.error : "Failed to schedule place.");
    }

    setSnapshot(data);
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
      throw new Error(typeof data?.error === "string" ? data.error : "Failed to update route mode.");
    }

    setSnapshot(data);
    setError(null);
  }

  function openAddModal() {
    setError(null);
    setEditingPlace(null);
    setIsAdding(true);
  }

  function openEditModal(place: Place) {
    setError(null);
    setEditingPlace(place);
    setIsAdding(true);
  }

  function closeModal() {
    setIsAdding(false);
    setEditingPlace(null);
  }

  function toggleSegmentSelection(id: number | null) {
    if (id === null) {
      setActiveSegmentId(null);
      return;
    }

    setActiveSegmentId((current) => toggleSelectedId(current, id));
  }

  return (
    <main className="app-shell">
      <LeftPanel
        itinerary={itinerary}
        places={snapshot.places}
        activePlaceId={activePlaceId}
        activeSegmentId={activeSegmentId}
        error={error}
        onAdd={openAddModal}
        onEdit={openEditModal}
        onDelete={(id) =>
          deletePlace(id).catch((reason) => {
            setError(reason instanceof Error ? reason.message : "Failed to delete place.");
          })
        }
        onSelectPlace={setActivePlaceId}
        onSelectSegment={toggleSegmentSelection}
        onSchedulePlace={(id, date, time) =>
          schedulePlace(id, date, time).catch((reason) => {
            setError(reason instanceof Error ? reason.message : "Failed to schedule place.");
          })
        }
        onModeChange={(id, mode) =>
          updateSegmentMode(id, mode).catch((reason) => {
            setError(reason instanceof Error ? reason.message : "Failed to update route mode.");
          })
        }
      />
      <MapPanel
        places={snapshot.places}
        itinerary={itinerary}
        routeSegments={snapshot.routeSegments}
        activePlaceId={activePlaceId}
        activeSegmentId={activeSegmentId}
        onSelectPlace={setActivePlaceId}
        onSelectSegment={toggleSegmentSelection}
      />
      {(isAdding || editingPlace) && (
        <AddEditPlaceModal
          place={editingPlace}
          onCancel={closeModal}
          onSave={(payload) => savePlace(payload, editingPlace?.id)}
        />
      )}
    </main>
  );
}
