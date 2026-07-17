import { useState, type Dispatch, type SetStateAction } from "react";

import { errorMessage } from "@/lib/error-message";
import {
  createItineraryItemRequest,
  deleteAllItineraryItemsRequest,
  deleteItineraryItemRequest,
  deletePlaceRequest,
  resolvePlaceRequest,
  saveItineraryItemRequest,
  savePlaceRequest,
  scheduleItineraryItemRequest,
  schedulePlaceRequest,
  updateSegmentModeRequest,
  type ResolvedPlace,
} from "@/lib/planner-api";
import type {
  ItineraryItem,
  Place,
  PlannerSnapshot,
  TravelMode,
} from "@/lib/types";

type TripPlannerMutationOptions = {
  tripId: number;
  canEdit: boolean;
  plannerSnapshot: PlannerSnapshot;
  setPlannerSnapshot: Dispatch<SetStateAction<PlannerSnapshot>>;
  setError: Dispatch<SetStateAction<string | null>>;
  closeModal: () => void;
  setAddingVisitPlace: (place: Place | null) => void;
  setEditingItem: (item: ItineraryItem | null) => void;
  clearActiveCanonicalPlace: () => void;
  clearDeletedPlaceSelection: (
    placeId: number,
    itineraryItems: readonly ItineraryItem[],
  ) => void;
  clearDeletedItineraryItemSelection: (itemId: number) => void;
  clearSelection: () => void;
};

export function useTripPlannerMutations(options: TripPlannerMutationOptions) {
  const [deletingPlaceIds, setDeletingPlaceIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [deletingItineraryItemIds, setDeletingItineraryItemIds] = useState<
    Set<number>
  >(() => new Set());
  const [isDeletingAllItineraryItems, setIsDeletingAllItineraryItems] =
    useState(false);

  async function resolvePlace(googleMapsUrl: string): Promise<ResolvedPlace> {
    return resolvePlaceRequest(options.tripId, googleMapsUrl);
  }

  async function savePlace(payload: Record<string, unknown>, id?: number) {
    if (!options.canEdit) return;
    try {
      options.setPlannerSnapshot(
        await savePlaceRequest(options.tripId, payload, id),
      );
      options.clearActiveCanonicalPlace();
      options.closeModal();
      options.setError(null);
    } catch (reason) {
      const message = errorMessage(reason, "Failed to save place.");
      options.setError(message);
      throw new Error(message);
    }
  }

  async function saveItineraryItem(
    payload: Record<string, unknown>,
    id: number,
  ) {
    if (!options.canEdit) return;
    try {
      options.setPlannerSnapshot(
        await saveItineraryItemRequest(options.tripId, payload, id),
      );
      options.setEditingItem(null);
      options.setError(null);
    } catch (reason) {
      const message = errorMessage(reason, "Failed to save visit.");
      options.setError(message);
      throw new Error(message);
    }
  }

  async function deletePlace(id: number) {
    if (!options.canEdit) return;
    if (deletingPlaceIds.has(id)) return;

    setDeletingPlaceIds((current) => new Set(current).add(id));
    try {
      options.setPlannerSnapshot(await deletePlaceRequest(options.tripId, id));
      options.clearDeletedPlaceSelection(
        id,
        options.plannerSnapshot.itineraryItems,
      );
      options.setError(null);
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
    if (!options.canEdit) return;
    options.setPlannerSnapshot(
      await schedulePlaceRequest(options.tripId, id, visitDate, visitTime),
    );
    options.setError(null);
  }

  async function createItineraryItem(
    placeId: number,
    payload: Record<string, unknown>,
  ) {
    if (!options.canEdit) return;
    try {
      options.setPlannerSnapshot(
        await createItineraryItemRequest(options.tripId, placeId, payload),
      );
      options.setAddingVisitPlace(null);
      options.setError(null);
    } catch (reason) {
      const message = errorMessage(reason, "Failed to add visit.");
      options.setError(message);
      throw new Error(message);
    }
  }

  async function scheduleItineraryItem(
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) {
    if (!options.canEdit) return;
    options.setPlannerSnapshot(
      await scheduleItineraryItemRequest(
        options.tripId,
        id,
        visitDate,
        visitTime,
      ),
    );
    options.setError(null);
  }

  async function deleteItineraryItem(id: number) {
    if (!options.canEdit) return;
    if (deletingItineraryItemIds.has(id)) return;

    setDeletingItineraryItemIds((current) => new Set(current).add(id));
    try {
      options.setPlannerSnapshot(
        await deleteItineraryItemRequest(options.tripId, id),
      );
      options.clearDeletedItineraryItemSelection(id);
      options.setError(null);
    } finally {
      setDeletingItineraryItemIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  async function deleteAllItineraryItems() {
    if (!options.canEdit) return;
    if (isDeletingAllItineraryItems) return;

    setIsDeletingAllItineraryItems(true);
    try {
      options.setPlannerSnapshot(
        await deleteAllItineraryItemsRequest(options.tripId),
      );
      options.clearSelection();
      options.setError(null);
    } finally {
      setIsDeletingAllItineraryItems(false);
    }
  }

  async function updateSegmentMode(id: number, mode: TravelMode) {
    if (!options.canEdit) return;
    options.setPlannerSnapshot(
      await updateSegmentModeRequest(options.tripId, id, mode),
    );
    options.setError(null);
  }

  return {
    deletingPlaceIds,
    deletingItineraryItemIds,
    isDeletingAllItineraryItems,
    resolvePlace,
    savePlace,
    saveItineraryItem,
    deletePlace,
    schedulePlace,
    createItineraryItem,
    scheduleItineraryItem,
    deleteItineraryItem,
    deleteAllItineraryItems,
    updateSegmentMode,
  };
}
