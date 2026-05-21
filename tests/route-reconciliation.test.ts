import { describe, expect, it } from "vitest";
import { reconcileRouteSegments } from "@/lib/route-reconciliation";
import type { ItineraryItem, RouteSegment } from "@/lib/types";

const stamp = "2026-05-19 00:00:00";

function place(
  id: number,
  name: string,
  visit_date: string | null,
  visit_time: string | null,
): ItineraryItem {
  const place = {
    id,
    name,
    address: null,
    google_maps_url: "https://www.google.com/maps",
    place_id: null,
    google_place_token: null,
    google_internal_ids: null,
    source_list_url: null,
    latitude: 40 + id,
    longitude: -73 - id,
    notes: null,
    created_at: stamp,
    updated_at: stamp,
  };

  return {
    id,
    place_id: id,
    visit_date,
    visit_time,
    notes: null,
    created_at: stamp,
    updated_at: stamp,
    place,
  };
}

function segment(
  id: number,
  from_item_id: number,
  to_item_id: number,
  mode: RouteSegment["mode"],
): RouteSegment {
  return {
    id,
    from_item_id,
    to_item_id,
    mode,
    created_at: stamp,
    updated_at: stamp,
  };
}

describe("reconcileRouteSegments", () => {
  it("creates segments only between consecutive timed places", () => {
    const result = reconcileRouteSegments(
      [
        place(1, "A", "2026-06-01", "09:00"),
        place(2, "B", "2026-06-01", "10:00"),
        place(3, "C", "2026-06-01", null),
        place(4, "D", null, null),
      ],
      [],
    );

    expect(result.toInsert).toEqual([
      { from_item_id: 1, to_item_id: 2, mode: "walking" },
    ]);
    expect(result.toDeleteIds).toEqual([]);
    expect(result.toKeepIds).toEqual([]);
  });

  it("preserves mode for unchanged valid pairs", () => {
    const existing = segment(8, 1, 2, "transit");
    const result = reconcileRouteSegments(
      [
        place(1, "A", "2026-06-01", "09:00"),
        place(2, "B", "2026-06-01", "10:00"),
      ],
      [existing],
    );

    expect(result.toKeepIds).toEqual([8]);
    expect(result.toInsert).toEqual([]);
    expect(result.preservedModes.get("1->2")).toBe("transit");
  });

  it("deletes invalid pairs after time changes reorder the day", () => {
    const result = reconcileRouteSegments(
      [
        place(1, "A", "2026-06-01", "11:00"),
        place(2, "B", "2026-06-01", "09:00"),
        place(3, "C", "2026-06-01", "10:00"),
      ],
      [segment(1, 1, 2, "walking"), segment(2, 2, 3, "bicycling")],
    );

    expect(result.toDeleteIds).toEqual([1]);
    expect(result.toKeepIds).toEqual([2]);
    expect(result.toInsert).toEqual([
      { from_item_id: 3, to_item_id: 1, mode: "walking" },
    ]);
  });

  it("deduplicates repeated existing rows for the same valid pair", () => {
    const result = reconcileRouteSegments(
      [
        place(1, "A", "2026-06-01", "09:00"),
        place(2, "B", "2026-06-01", "10:00"),
      ],
      [segment(1, 1, 2, "driving"), segment(2, 1, 2, "walking")],
    );

    expect(result.toKeepIds).toEqual([1]);
    expect(result.toDeleteIds).toEqual([2]);
    expect(result.toInsert).toEqual([]);
  });

  it("treats malformed visit times as untimed for route creation", () => {
    const result = reconcileRouteSegments(
      [
        place(1, "A", "2026-06-01", "09:00"),
        place(2, "B", "2026-06-01", "foo"),
        place(3, "C", "2026-06-01", "10:00"),
      ],
      [],
    );

    expect(result.toInsert).toEqual([
      { from_item_id: 1, to_item_id: 3, mode: "walking" },
    ]);
    expect(result.toKeepIds).toEqual([]);
    expect(result.toDeleteIds).toEqual([]);
  });
});
