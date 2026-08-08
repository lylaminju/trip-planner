import { describe, expect, it } from "vitest";

import {
  buildAiGeneratedPlaceRows,
  buildGeneratedScheduleEntries,
  splitGeneratedPlaceIds,
} from "@/server/ai-plan-batch-rows";
import {
  LUNCH_VERIFICATION_STATUS,
  type EnrichedLunchStop,
} from "@/server/ai-lunch-enrichment";
import type {
  AiDestinationCandidate,
  AiTransitHubType,
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
      fallback_emoji: "🏨",
    });
    expect(rows[1]).toMatchObject({
      name: "Candidate 10",
      image_url: "https://images.example/candidate-10.webp",
      image_credit: "Photo: Example Author",
      fallback_emoji: null,
    });
  });

  it("labels arrival and departure anchors with their transit hub emoji", () => {
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
      candidateById: new Map([[10, candidate(10)]]),
      lodging: lodging(),
      arrivalPoint: transitPoint("arrival", "11:00", "airport"),
      departurePoint: transitPoint("departure", "18:00", "train_station"),
    });

    // Anchor order is arrival, lodging, departure, then the day's attractions.
    expect(rows.map((row) => row.fallback_emoji)).toEqual([
      "✈️",
      "🏨",
      "🚆",
      null,
    ]);
  });

  it("leaves a custom transit point without a hub type unlabeled", () => {
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
      candidateById: new Map([[10, candidate(10)]]),
      lodging: null,
      arrivalPoint: transitPoint("arrival", "11:00", null),
    });

    expect(rows[0]).toMatchObject({ name: "JFK Airport", fallback_emoji: null });
  });

  it("stores a note's markdown link on the place instead of in the note text", () => {
    const plan = {
      days: [
        {
          date: "2026-08-10",
          visits: [
            {
              candidate_id: 10,
              start_time: "09:00",
              duration_minutes: 120,
              notes:
                "Closed Mondays; check [hours](https://example.com/visit?utm_source=openai) first.",
            },
          ],
        },
      ],
    };
    const candidateById = new Map([[10, candidate(10)]]);

    const rows = buildAiGeneratedPlaceRows({
      tripId: 1,
      generationId: 5,
      plan,
      candidateById,
      lodging: null,
    });
    const entries = buildGeneratedScheduleEntries({
      plan,
      candidateById,
      lodging: null,
      lodgingStartTime: "09:00",
      lodgingPlaceId: null,
      candidatePlaceIds: [102],
    });

    expect(rows[0]).toMatchObject({
      notes: "Closed Mondays; check hours first.",
      links: ["https://example.com/visit"],
    });
    expect(entries[0].notes).toBe("Closed Mondays; check hours first.");
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

  it("spaces items onto later grid slots when times would collide", () => {
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
              {
                candidate_id: 11,
                start_time: "09:00",
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
      candidatePlaceIds: [102, 103],
      // No travel duration resolved, so the raw 09:00 model times would all
      // collide with the lodging anchor and each other without spacing.
    });

    expect(
      entries.map((entry) => ({
        placeId: entry.placeId,
        startTime: entry.startTime,
      })),
    ).toEqual([
      // The lodging is left rather than dwelt at, so the first attraction only
      // needs the next slot; the second waits out the first's two hours.
      { placeId: 101, startTime: "09:00" },
      { placeId: 102, startTime: "09:10" },
      { placeId: 103, startTime: "11:10" },
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
                duration_minutes: 60,
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

  it("inserts the lodging after the day-one arrival stop and appends the departure stop", () => {
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
      // Day one: arrive at the hub, then the lodging (15:00 + 60m airport
      // egress buffer + 30m hub-to-lodging travel), then the first attraction.
      { date: "2026-08-10", placeId: 100, startTime: "15:00" },
      { date: "2026-08-10", placeId: 101, startTime: "16:30" },
      { date: "2026-08-10", placeId: 102, startTime: "16:40" },
      { date: "2026-08-11", placeId: 101, startTime: "09:00" },
      { date: "2026-08-11", placeId: 104, startTime: "10:00" },
      { date: "2026-08-11", placeId: 103, startTime: "18:30" },
    ]);
  });

  it("times the day-one lodging stop with the non-airport egress buffer", () => {
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
      arrivalPoint: transitPoint("arrival", "10:00", "train_station"),
      arrivalPlaceId: 100,
      candidatePlaceIds: [102],
      // Measured hub-to-lodging travel is 20 minutes.
      firstVisitTravelDurationsByDate: new Map([["2026-08-10", 20 * 60]]),
    });

    expect(
      entries.map((entry) => ({
        placeId: entry.placeId,
        startTime: entry.startTime,
      })),
    ).toEqual([
      { placeId: 100, startTime: "10:00" },
      // 10:00 + 15m train-station egress buffer + 20m travel, rounded to grid.
      { placeId: 101, startTime: "10:40" },
      { placeId: 102, startTime: "10:50" },
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

  it("writes the transit stop once when the trip departs from where it arrived", () => {
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
      candidateById: new Map([[10, candidate(10)]]),
      lodging: lodging(),
      arrivalPoint: transitPoint("arrival", "11:00"),
      departurePoint: {
        ...transitPoint("departure", "18:00"),
        name: "JFK Airport",
      },
    });

    expect(rows.map((row) => row.name)).toEqual([
      "JFK Airport",
      "Pod Times Square",
      "Candidate 10",
    ]);
  });

  it("maps inserted place ids back to arrival, lodging, departure, and candidates", () => {
    expect(
      splitGeneratedPlaceIds([1, 2, 3, 4, 5], {
        hasArrival: true,
        hasLodging: true,
        hasDeparture: true,
        departureReusesArrivalPlace: false,
      }),
    ).toEqual({
      arrivalPlaceId: 1,
      lodgingPlaceId: 2,
      departurePlaceId: 3,
      candidatePlaceIds: [4, 5],
      lunchPlaceIdsByDate: new Map(),
    });

    expect(
      splitGeneratedPlaceIds([1, 2, 3], {
        hasArrival: false,
        hasLodging: true,
        hasDeparture: false,
        departureReusesArrivalPlace: false,
      }),
    ).toEqual({
      arrivalPlaceId: null,
      lodgingPlaceId: 1,
      departurePlaceId: null,
      candidatePlaceIds: [2, 3],
      lunchPlaceIdsByDate: new Map(),
    });
  });

  it("appends lunch place rows after visits and maps their ids by date", () => {
    const plan = {
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
          lunch: null,
        },
      ],
    };
    const lunchByDate = new Map([["2026-08-10", enrichedLunch()]]);

    const rows = buildAiGeneratedPlaceRows({
      tripId: 1,
      generationId: 5,
      plan,
      candidateById: new Map([[10, candidate(10)]]),
      lodging: lodging(),
      lunchByDate,
    });

    expect(rows).toHaveLength(3);
    expect(rows[2]).toMatchObject({
      name: "Chez Janou",
      google_place_id: "google-place-1",
      google_maps_url: "https://maps.google.com/?cid=1",
      notes: "★ 4.6 (1,234 reviews) · $$ — Great pasta.",
      fallback_emoji: "🍽️",
      created_by_source: "ai",
    });

    const split = splitGeneratedPlaceIds(
      [7, 8, 9],
      {
        hasArrival: false,
        hasLodging: true,
        hasDeparture: false,
        departureReusesArrivalPlace: false,
      },
      ["2026-08-10"],
    );
    expect(split).toEqual({
      arrivalPlaceId: null,
      lodgingPlaceId: 7,
      departurePlaceId: null,
      candidatePlaceIds: [8],
      lunchPlaceIdsByDate: new Map([["2026-08-10", 9]]),
    });
  });

  it("slots the lunch entry into the day's schedule by start time", () => {
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
              {
                candidate_id: 11,
                start_time: "14:00",
                duration_minutes: 60,
                notes: null,
              },
            ],
            lunch: null,
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
      candidatePlaceIds: [31, 32],
      lunchByDate: new Map([["2026-08-10", enrichedLunch()]]),
      lunchPlaceIdsByDate: new Map([["2026-08-10", 40]]),
    });

    expect(
      entries.map((entry) => [entry.placeId, entry.startTime]),
    ).toEqual([
      [31, "09:00"],
      [40, "12:30"],
      [32, "14:00"],
    ]);
    expect(entries[1].notes).toBe("★ 4.6 (1,234 reviews) · $$ — Great pasta.");
    expect(entries[1].location).toEqual({ latitude: 48.856, longitude: 2.365 });
  });

  it("sends the round-trip departure back to the arrival place id", () => {
    expect(
      splitGeneratedPlaceIds([1, 2, 3], {
        hasArrival: true,
        hasLodging: true,
        hasDeparture: true,
        departureReusesArrivalPlace: true,
      }),
    ).toEqual({
      arrivalPlaceId: 1,
      lodgingPlaceId: 2,
      departurePlaceId: 1,
      candidatePlaceIds: [3],
      lunchPlaceIdsByDate: new Map(),
    });
  });
});

function enrichedLunch(): EnrichedLunchStop {
  return {
    name: "Chez Janou",
    latitude: 48.856,
    longitude: 2.365,
    start_time: "12:30",
    duration_minutes: 60,
    notes: "Great pasta.",
    google_place_id: "google-place-1",
    google_maps_url: "https://maps.google.com/?cid=1",
    rating: 4.6,
    user_rating_count: 1234,
    price_symbol: "$$",
    verification: LUNCH_VERIFICATION_STATUS.VERIFIED,
  };
}

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
  hubType: AiTransitHubType | null = "airport",
): TripTransitPoint {
  return {
    id: kind === "arrival" ? 20 : 21,
    trip_id: 1,
    kind,
    name: kind === "arrival" ? "JFK Airport" : "Newark Airport",
    latitude: 40.64,
    longitude: -73.78,
    google_place_id: null,
    hub_type: hubType,
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
