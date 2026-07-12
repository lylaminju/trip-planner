import { useCallback, useState } from "react";

import type { ItineraryItem } from "@/lib/types";
import {
  clearSelection as clearSelectionState,
  clearSelectionForDeletedItineraryItem,
  clearSelectionForDeletedPlace,
  EMPTY_TRIP_PLANNER_SELECTION,
  selectCanonicalPlace as selectCanonicalPlaceState,
  selectDate as selectDateState,
  selectItineraryItem,
  toggleSegmentSelection as toggleSegmentSelectionState,
} from "@/lib/trip-planner-selection";

export function useTripPlannerSelection() {
  const [selection, setSelection] = useState(EMPTY_TRIP_PLANNER_SELECTION);

  const selectItem = useCallback((id: number | null) => {
    setSelection((current) => selectItineraryItem(current, id));
  }, []);

  const selectCanonicalPlace = useCallback((id: number | null) => {
    setSelection((current) => selectCanonicalPlaceState(current, id));
  }, []);

  const toggleSegmentSelection = useCallback((id: number | null) => {
    setSelection((current) => toggleSegmentSelectionState(current, id));
  }, []);

  const selectDate = useCallback((date: string) => {
    setSelection((current) => selectDateState(current, date));
  }, []);

  const clearSelection = useCallback(() => {
    setSelection((current) => clearSelectionState(current));
  }, []);

  const clearActiveCanonicalPlace = useCallback(() => {
    setSelection((current) => ({
      ...current,
      activeCanonicalPlaceId: null,
    }));
  }, []);

  const clearDeletedPlaceSelection = useCallback(
    (placeId: number, itineraryItems: readonly ItineraryItem[]) => {
      setSelection((current) =>
        clearSelectionForDeletedPlace(current, placeId, itineraryItems),
      );
    },
    [],
  );

  const clearDeletedItineraryItemSelection = useCallback((itemId: number) => {
    setSelection((current) =>
      clearSelectionForDeletedItineraryItem(current, itemId),
    );
  }, []);

  return {
    ...selection,
    selectItem,
    selectCanonicalPlace,
    toggleSegmentSelection,
    selectDate,
    clearSelection,
    clearActiveCanonicalPlace,
    clearDeletedPlaceSelection,
    clearDeletedItineraryItemSelection,
  };
}
