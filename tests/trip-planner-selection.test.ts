import { describe, expect, it } from "vitest";

import {
  clearSelectionForDeletedItineraryItem,
  clearSelectionForDeletedPlace,
  selectCanonicalPlace,
  selectDate,
  selectItineraryItem,
  toggleSegmentSelection,
  type TripPlannerSelectionState,
} from "@/lib/trip-planner-selection";
import type { ItineraryItem } from "@/lib/types";
import { buildPlace } from "./helpers/fixtures";

const selectedEverything: TripPlannerSelectionState = {
  activeItemId: 10,
  activeCanonicalPlaceId: 20,
  activeSegmentId: 30,
  activeDate: "2026-06-01",
};

describe("trip planner selection state", () => {
  it("keeps item selection behavior compatible with the planner app", () => {
    expect(selectItineraryItem(selectedEverything, 11)).toEqual({
      activeItemId: 11,
      activeCanonicalPlaceId: null,
      activeSegmentId: 30,
      activeDate: null,
    });
  });

  it("clears competing selections when selecting a canonical place", () => {
    expect(selectCanonicalPlace(selectedEverything, 21)).toEqual({
      activeItemId: null,
      activeCanonicalPlaceId: 21,
      activeSegmentId: null,
      activeDate: null,
    });
  });

  it("toggles segment selection and clears place/date selections", () => {
    expect(toggleSegmentSelection(selectedEverything, 30)).toEqual({
      activeItemId: null,
      activeCanonicalPlaceId: null,
      activeSegmentId: null,
      activeDate: null,
    });

    expect(toggleSegmentSelection(selectedEverything, 31)).toEqual({
      activeItemId: null,
      activeCanonicalPlaceId: null,
      activeSegmentId: 31,
      activeDate: null,
    });
  });

  it("toggles date selection and clears place/segment selections", () => {
    expect(selectDate(selectedEverything, "2026-06-01")).toEqual({
      activeItemId: null,
      activeCanonicalPlaceId: null,
      activeSegmentId: null,
      activeDate: null,
    });

    expect(selectDate(selectedEverything, "2026-06-02")).toEqual({
      activeItemId: null,
      activeCanonicalPlaceId: null,
      activeSegmentId: null,
      activeDate: "2026-06-02",
    });
  });

  it("clears deleted place selections including visits for that place", () => {
    const items = [
      buildItineraryItem({ id: 10, place_id: 20 }),
      buildItineraryItem({ id: 11, place_id: 21 }),
    ];

    expect(clearSelectionForDeletedPlace(selectedEverything, 20, items)).toEqual({
      activeItemId: null,
      activeCanonicalPlaceId: null,
      activeSegmentId: null,
      activeDate: "2026-06-01",
    });
  });

  it("clears deleted itinerary item selections", () => {
    expect(clearSelectionForDeletedItineraryItem(selectedEverything, 10)).toEqual({
      activeItemId: null,
      activeCanonicalPlaceId: 20,
      activeSegmentId: null,
      activeDate: null,
    });
  });
});

function buildItineraryItem(
  overrides: Partial<ItineraryItem> = {},
): ItineraryItem {
  const place = buildPlace({ id: overrides.place_id ?? 20 });

  return {
    id: 10,
    trip_id: place.trip_id,
    place_id: place.id,
    visit_date: "2026-06-01",
    visit_time: "09:00",
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    place,
    ...overrides,
  };
}
