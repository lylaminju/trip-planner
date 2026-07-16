import { describe, expect, it } from "vitest";

import {
  buildAiGeneratedPlaceRows,
  buildGeneratedScheduleEntries,
  splitGeneratedPlaceIds,
} from "@/server/ai-plan-batch-rows";
import type {
  AiDestinationCandidate,
  TripLodging,
  TripTransitPoint,
  TripTransitPointKind,
} from "@/lib/types";

describe("AI plan batch rows", () => {
  it("copies candidate imagery onto generated place rows and keeps anchors bare", () => {
    const rows = buildAiGeneratedPlaceRows({
      tripId: 1,
      generationId: 5,
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
      candidateById: new Map([
        [
          10,
          {
            ...candidate(10),
            image_url: "https://images.example/candidate-10.webp",
            image_credit: "Photo: Example Author",
          },
        ],
      ]),
      lodging: lodging(),
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: "Pod Times Square",
      image_url: null,
      image_credit: null,
    });
    expect(rows[1]).toMatchObject({
      name: "Candidate 10",
      image_url: "https://images.example/candidate-10.webp",
      image_credit: "Photo: Example Author",
    });
  });

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

  it("replaces the day-one lodging anchor with the arrival stop and appends the departure stop", () => {
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
          {
            date: "2026-08-11",
            visits: [
              {
                candidate_id: 11,
                start_time: "10:00",
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
      lodging: lodging(),
      lodgingStartTime: "09:00",
      lodgingPlaceId: 101,
      arrivalPoint: transitPoint("arrival", "15:00"),
      arrivalPlaceId: 100,
      departurePoint: transitPoint("departure", "18:30"),
      departurePlaceId: 103,
      candidatePlaceIds: [102, 104],
      firstVisitTravelDurationsByDate: new Map([["2026-08-10", 30 * 60]]),
    });

    expect(
      entries.map((entry) => ({
        date: entry.date,
        placeId: entry.placeId,
        startTime: entry.startTime,
      })),
    ).toEqual([
      { date: "2026-08-10", placeId: 100, startTime: "15:00" },
      { date: "2026-08-10", placeId: 102, startTime: "15:30" },
      { date: "2026-08-11", placeId: 101, startTime: "09:00" },
      { date: "2026-08-11", placeId: 104, startTime: "10:00" },
      { date: "2026-08-11", placeId: 103, startTime: "18:30" },
    ]);
  });

  it("anchors a single-day trip on arrival and departure without lodging", () => {
    const entries = buildGeneratedScheduleEntries({
      plan: {
        days: [
          {
            date: "2026-08-10",
            visits: [
              {
                candidate_id: 10,
                start_time: "12:00",
                duration_minutes: 60,
                notes: null,
              },
            ],
          },
        ],
      },
      candidateById: new Map([[10, candidate(10)]]),
      lodging: null,
      lodgingStartTime: "09:00",
      lodgingPlaceId: null,
      arrivalPoint: transitPoint("arrival", "11:00"),
      arrivalPlaceId: 100,
      departurePoint: transitPoint("departure", null),
      departurePlaceId: 103,
      candidatePlaceIds: [102],
    });

    expect(
      entries.map((entry) => ({
        placeId: entry.placeId,
        startTime: entry.startTime,
      })),
    ).toEqual([
      { placeId: 100, startTime: "11:00" },
      { placeId: 102, startTime: "12:00" },
      // No departure time given: departs after the last visit ends.
      { placeId: 103, startTime: "13:00" },
    ]);
  });

  it("maps inserted place ids back to arrival, lodging, departure, and candidates", () => {
    expect(
      splitGeneratedPlaceIds([1, 2, 3, 4, 5], {
        hasArrival: true,
        hasLodging: true,
        hasDeparture: true,
      }),
    ).toEqual({
      arrivalPlaceId: 1,
      lodgingPlaceId: 2,
      departurePlaceId: 3,
      candidatePlaceIds: [4, 5],
    });

    expect(
      splitGeneratedPlaceIds([1, 2, 3], {
        hasArrival: false,
        hasLodging: true,
        hasDeparture: false,
      }),
    ).toEqual({
      arrivalPlaceId: null,
      lodgingPlaceId: 1,
      departurePlaceId: null,
      candidatePlaceIds: [2, 3],
    });
  });
});

function lodging(): TripLodging {
  return {
    id: 7,
    trip_id: 1,
    name: "Pod Times Square",
    latitude: 40.758,
    longitude: -73.993,
    google_place_id: "google-pod",
    is_primary: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function transitPoint(
  kind: TripTransitPointKind,
  eventTime: string | null,
): TripTransitPoint {
  return {
    id: kind === "arrival" ? 20 : 21,
    trip_id: 1,
    kind,
    name: kind === "arrival" ? "JFK Airport" : "Newark Airport",
    latitude: 40.64,
    longitude: -73.78,
    google_place_id: null,
    event_time: eventTime,
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
    blurb: null,
    image_url: null,
    image_credit: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}
