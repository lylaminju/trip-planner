import { describe, expect, it } from "vitest";

import {
  inferEndVisitTime,
  inferInsertedVisitTime,
} from "@/components/planner-panel/drag-schedule";
import type { ItineraryItem, Place } from "@/lib/types";

const stamp = "2026-05-20 00:00:00";

describe("drag schedule helpers", () => {
  it("inserts a midpoint time between two timed visits", () => {
    const result = inferInsertedVisitTime(
      itineraryItem({ id: 1, visit_time: "09:00" }),
      itineraryItem({ id: 2, visit_time: "10:00" }),
    );

    expect(result).toBe("09:30");
  });

  it("skips malformed visit times when inferring the end visit time", () => {
    const result = inferEndVisitTime([
      itineraryItem({ id: 1, visit_time: "09:00" }),
      itineraryItem({ id: 2, visit_time: "foo" }),
      itineraryItem({ id: 3, visit_time: "10:00" }),
    ]);

    expect(result).toBe("11:00");
  });

  it("caps inferred end times at the end of the day", () => {
    const result = inferEndVisitTime([
      itineraryItem({ id: 1, visit_time: "23:30" }),
    ]);

    expect(result).toBe("23:59");
  });
});

function itineraryItem(
  overrides: Partial<ItineraryItem> & { id: number; visit_time: string | null },
): ItineraryItem {
  const place = buildPlace(overrides.id);

  return {
    id: overrides.id,
    trip_id: overrides.trip_id ?? 1,
    place_id: overrides.place_id ?? place.id,
    place,
    visit_date: overrides.visit_date ?? "2026-06-01",
    visit_time: overrides.visit_time,
    notes: overrides.notes ?? null,
    created_at: overrides.created_at ?? stamp,
    updated_at: overrides.updated_at ?? stamp,
  };
}

function buildPlace(id: number): Place {
  return {
    id,
    trip_id: 1,
    name: `Place ${id}`,
    address: null,
    google_maps_url: "https://www.google.com/maps/place",
    place_id: null,
    google_place_token: null,
    google_internal_ids: null,
    source_list_url: null,
    latitude: 40,
    longitude: -74,
    notes: null,
    links: [],
    image_url: null,
    image_credit: null,
    created_at: stamp,
    updated_at: stamp,
  };
}
