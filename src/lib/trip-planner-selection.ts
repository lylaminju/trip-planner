import type { ItineraryItem } from "@/lib/types";
import { toggleSelectedId } from "@/lib/selection";

export type TripPlannerSelectionState = {
  activeItemId: number | null;
  activeCanonicalPlaceId: number | null;
  activeSegmentId: number | null;
  activeDate: string | null;
};

export const EMPTY_TRIP_PLANNER_SELECTION: TripPlannerSelectionState = {
  activeItemId: null,
  activeCanonicalPlaceId: null,
  activeSegmentId: null,
  activeDate: null,
};

export function selectItineraryItem(
  selection: TripPlannerSelectionState,
  id: number | null,
): TripPlannerSelectionState {
  return {
    ...selection,
    activeDate: null,
    activeCanonicalPlaceId: null,
    activeItemId: id,
  };
}

export function selectCanonicalPlace(
  selection: TripPlannerSelectionState,
  id: number | null,
): TripPlannerSelectionState {
  return {
    ...selection,
    activeDate: null,
    activeItemId: null,
    activeSegmentId: null,
    activeCanonicalPlaceId: id,
  };
}

export function toggleSegmentSelection(
  selection: TripPlannerSelectionState,
  id: number | null,
): TripPlannerSelectionState {
  if (id === null) {
    return {
      ...selection,
      activeSegmentId: null,
    };
  }

  return {
    ...selection,
    activeDate: null,
    activeItemId: null,
    activeCanonicalPlaceId: null,
    activeSegmentId: toggleSelectedId(selection.activeSegmentId, id),
  };
}

export function selectDate(
  selection: TripPlannerSelectionState,
  date: string,
): TripPlannerSelectionState {
  return {
    ...selection,
    activeDate: selection.activeDate === date ? null : date,
    activeItemId: null,
    activeCanonicalPlaceId: null,
    activeSegmentId: null,
  };
}

export function clearSelection(
  selection: TripPlannerSelectionState,
): TripPlannerSelectionState {
  if (
    selection.activeItemId === null &&
    selection.activeCanonicalPlaceId === null &&
    selection.activeSegmentId === null &&
    selection.activeDate === null
  ) {
    return selection;
  }

  return EMPTY_TRIP_PLANNER_SELECTION;
}

export function clearSelectionForDeletedPlace(
  selection: TripPlannerSelectionState,
  placeId: number,
  itineraryItems: readonly ItineraryItem[],
): TripPlannerSelectionState {
  const deletedItemIds = itineraryItems
    .filter((item) => item.place_id === placeId)
    .map((item) => item.id);

  return {
    ...selection,
    activeItemId: deletedItemIds.includes(selection.activeItemId ?? -1)
      ? null
      : selection.activeItemId,
    activeCanonicalPlaceId:
      selection.activeCanonicalPlaceId === placeId
        ? null
        : selection.activeCanonicalPlaceId,
    activeSegmentId: null,
  };
}

export function clearSelectionForDeletedItineraryItem(
  selection: TripPlannerSelectionState,
  itemId: number,
): TripPlannerSelectionState {
  return {
    ...selection,
    activeItemId: selection.activeItemId === itemId ? null : selection.activeItemId,
    activeSegmentId: null,
    activeDate: null,
  };
}
