import { describe, expect, it } from "vitest";
import {
  applyOptimisticReconciliation,
  reconcileRouteSegments,
} from "@/lib/route-reconciliation";
import type { ItineraryItem, RouteSegment } from "@/lib/types";

const stamp = "2026-05-19 00:00:00";

function place(
  id: number,
  name: string,
  visit_date: string | null,
  visit_time: string | null,
  coordinates?: { latitude: number; longitude: number },
): ItineraryItem {
  const place = {
    id,
    trip_id: 1,
    name,
    address: null,
    google_maps_url: "https://www.google.com/maps",
    google_place_id: null,
    google_place_token: null,
    google_internal_ids: null,
    source_list_url: null,
    // Roughly 110 m apart per id step, so default pairs stay walkable.
    latitude: coordinates?.latitude ?? 40 + id * 0.001,
    longitude: coordinates?.longitude ?? -73,
    notes: null,
    links: [],
    image_url: null,
    image_credit: null,
    created_at: stamp,
    updated_at: stamp,
  };

  return {
    id,
    trip_id: 1,
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
    trip_id: 1,
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
  });

  it("leaves unchanged valid pairs untouched", () => {
    const existing = segment(8, 1, 2, "transit");
    const result = reconcileRouteSegments(
      [
        place(1, "A", "2026-06-01", "09:00"),
        place(2, "B", "2026-06-01", "10:00"),
      ],
      [existing],
    );

    expect(result.toDeleteIds).toEqual([]);
    expect(result.toInsert).toEqual([]);
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

    expect(result.toDeleteIds).toEqual([2]);
    expect(result.toInsert).toEqual([]);
  });

  it("defaults to driving when stops are more than 2 km apart", () => {
    const result = reconcileRouteSegments(
      [
        place(1, "A", "2026-06-01", "09:00", {
          latitude: 51.1784,
          longitude: -115.5708,
        }),
        place(2, "B", "2026-06-01", "10:00", {
          latitude: 51.4254,
          longitude: -116.1773,
        }),
      ],
      [],
    );

    expect(result.toInsert).toEqual([
      { from_item_id: 1, to_item_id: 2, mode: "driving" },
    ]);
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
    expect(result.toDeleteIds).toEqual([]);
  });
});

describe("applyOptimisticReconciliation", () => {
  it("returns the same array when the schedule needs no segment changes", () => {
    const segments = [segment(8, 1, 2, "transit")];
    const result = applyOptimisticReconciliation(
      [
        place(1, "A", "2026-06-01", "09:00"),
        place(2, "B", "2026-06-01", "10:00"),
      ],
      segments,
      1,
    );

    expect(result).toBe(segments);
  });

  it("replaces stale segments with walking placeholders for new pairs", () => {
    const result = applyOptimisticReconciliation(
      [
        place(1, "A", "2026-06-01", "11:00"),
        place(2, "B", "2026-06-01", "09:00"),
        place(3, "C", "2026-06-01", "10:00"),
      ],
      [segment(1, 1, 2, "walking"), segment(2, 2, 3, "bicycling")],
      1,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(segment(2, 2, 3, "bicycling"));
    expect(result[1]).toMatchObject({
      trip_id: 1,
      from_item_id: 3,
      to_item_id: 1,
      mode: "walking",
    });
    expect(result[1].id).toBeLessThan(0);
  });

  it("keeps placeholder ids unique below existing optimistic ids", () => {
    const result = applyOptimisticReconciliation(
      [
        place(1, "A", "2026-06-01", "09:00"),
        place(2, "B", "2026-06-01", "10:00"),
        place(3, "C", "2026-06-01", "11:00"),
      ],
      [segment(-1, 1, 2, "walking")],
      1,
    );

    expect(result.map((item) => item.id)).toEqual([-1, -2]);
    expect(result[1]).toMatchObject({
      from_item_id: 2,
      to_item_id: 3,
      mode: "walking",
    });
  });
});
