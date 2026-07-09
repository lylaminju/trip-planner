import { describe, expect, it } from "vitest";

import { buildGeneratedScheduleEntries } from "@/server/ai-plan-batch-rows";
import type { AiDestinationCandidate, TripLodging } from "@/lib/types";

describe("AI plan batch rows", () => {
  it("moves the first attraction after the lodging travel duration on the 10-minute grid", () => {
    const entries = buildGeneratedScheduleEntries({
      plan: {
        days: [
          {
            date: "2026-08-10",
            visits: [
              {
                candidate_id: 10,
                start_time: "09:00",
                duration_minutes: 120,
                notes: null,
              },
            ],
          },
        ],
      },
      candidateById: new Map([[10, candidate(10)]]),
      lodging: lodging(),
      lodgingStartTime: "09:00",
      lodgingPlaceId: 101,
      candidatePlaceIds: [102],
      firstVisitTravelDurationsByDate: new Map([["2026-08-10", 18 * 60]]),
    });

    expect(
      entries.map((entry) => ({
        placeId: entry.placeId,
        startTime: entry.startTime,
      })),
    ).toEqual([
      { placeId: 101, startTime: "09:00" },
      { placeId: 102, startTime: "09:20" },
    ]);
  });

  it("rounds generated attraction times up to the 10-minute grid", () => {
    const entries = buildGeneratedScheduleEntries({
      plan: {
        days: [
          {
            date: "2026-08-10",
            visits: [
              {
                candidate_id: 10,
                start_time: "09:27",
                duration_minutes: 120,
                notes: null,
              },
              {
                candidate_id: 11,
                start_time: "10:40",
                duration_minutes: 90,
                notes: null,
              },
            ],
          },
        ],
      },
      candidateById: new Map([
        [10, candidate(10)],
        [11, candidate(11)],
      ]),
      lodging: null,
      lodgingStartTime: "09:00",
      lodgingPlaceId: null,
      candidatePlaceIds: [101, 102],
    });

    expect(
      entries.map((entry) => ({
        placeId: entry.placeId,
        startTime: entry.startTime,
      })),
    ).toEqual([
      { placeId: 101, startTime: "09:30" },
      { placeId: 102, startTime: "10:40" },
    ]);
  });
});

function lodging(): TripLodging {
  return {
    id: 7,
    trip_id: 1,
    name: "Pod Times Square",
    address: "400 W 42nd St",
    latitude: 40.758,
    longitude: -73.993,
    google_place_id: "google-pod",
    check_in_date: null,
    check_out_date: null,
    is_primary: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function candidate(id: number): AiDestinationCandidate {
  return {
    id,
    destination_slug: "new-york-city",
    name: `Candidate ${id}`,
    category: "landmark",
    tags: ["landmarks"],
    area: "Manhattan",
    region_distance_tier: "central",
    sort_order: id,
    latitude: 40,
    longitude: -74,
    google_place_id: null,
    typical_duration_minutes: 90,
    indoor_outdoor: "mixed",
    planning_note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}
