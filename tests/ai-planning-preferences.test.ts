import { describe, expect, it } from "vitest";

import {
  AI_DEFAULT_PLANNING_PREFERENCES,
  aiCoverageMinTotalVisits,
  aiCoverageSightseeingDayRange,
  buildAiPlanningPreferenceDraft,
  isAiCoverageTrip,
} from "@/lib/ai-planning-preferences";
import { parseAiPlanningGenerationInput } from "@/server/ai-planning-preferences";
import type { AiPlanningSetup } from "@/lib/types";

describe("ai planning preference defaults", () => {
  it("uses MVP defaults when the trip has no saved preferences", () => {
    expect(buildAiPlanningPreferenceDraft(setup())).toEqual(
      AI_DEFAULT_PLANNING_PREFERENCES,
    );
  });

  it("reuses saved preferences and filters must-see IDs to curated candidates", () => {
    expect(
      buildAiPlanningPreferenceDraft(
        setup({
          preferences: {
            trip_id: 1,
            visits_per_day_min: 1,
            visits_per_day_max: 5,
            interest_tags: ["nature", "museums"],
            preferred_travel_modes: ["walking"],
            must_see_candidate_ids: [10, 99],
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        }),
      ),
    ).toEqual({
      visits_per_day_min: 1,
      visits_per_day_max: 5,
      interest_tags: ["nature", "museums"],
      preferred_travel_modes: ["walking"],
      must_see_candidate_ids: [10],
    });
  });

  it("keeps the current interest-tag vocabulary and drops retired tags", () => {
    expect(
      buildAiPlanningPreferenceDraft(
        setup({
          preferences: {
            trip_id: 1,
            visits_per_day_min: 2,
            visits_per_day_max: 3,
            interest_tags: [
              "local-vibe",
              "food",
              "kid-friendly",
              "neighborhoods",
            ],
            preferred_travel_modes: ["walking"],
            must_see_candidate_ids: [],
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        }),
      ).interest_tags,
    ).toEqual(["local-vibe", "food", "kid-friendly"]);
  });

  it("accepts five visits per day as the upper bound", () => {
    expect(
      parseAiPlanningGenerationInput(
        {
          visits_per_day_min: 2,
          visits_per_day_max: 5,
          preferred_travel_modes: ["walking"],
          must_see_candidate_ids: [],
        },
        new Set([10]),
      ).preferences,
    ).toMatchObject({
      visits_per_day_min: 2,
      visits_per_day_max: 5,
    });
  });

  it("parses an optional lodging Google Maps URL for generation without saving it as a preference", () => {
    expect(
      parseAiPlanningGenerationInput(
        {
          visits_per_day_min: 1,
          visits_per_day_max: 3,
          interest_tags: ["nature"],
          preferred_travel_modes: ["walking", "transit"],
          must_see_candidate_ids: [10],
          daily_start_time: "08:30",
          lodging_google_maps_url: " https://maps.app.goo.gl/example ",
        },
        new Set([10]),
      ),
    ).toEqual({
      preferences: {
        visits_per_day_min: 1,
        visits_per_day_max: 3,
        interest_tags: ["nature"],
        preferred_travel_modes: ["walking", "transit"],
        must_see_candidate_ids: [10],
      },
      daily_start_time: "08:30",
      lodging_google_maps_url: "https://maps.app.goo.gl/example",
      arrival_hub_id: null,
      arrival_google_maps_url: null,
      arrival_time: null,
      departure_hub_id: null,
      departure_google_maps_url: null,
      departure_time: null,
    });
  });

  it("parses optional arrival and departure stops with times for generation", () => {
    expect(
      parseAiPlanningGenerationInput(
        {
          visits_per_day_min: 1,
          visits_per_day_max: 3,
          preferred_travel_modes: ["walking"],
          arrival_google_maps_url: " https://maps.app.goo.gl/arrive ",
          arrival_time: "15:30",
          departure_google_maps_url: "https://maps.app.goo.gl/depart",
          departure_time: " ",
        },
        new Set([10]),
      ),
    ).toMatchObject({
      arrival_google_maps_url: "https://maps.app.goo.gl/arrive",
      arrival_time: "15:30",
      departure_google_maps_url: "https://maps.app.goo.gl/depart",
      departure_time: null,
    });
  });

  it("accepts transit hub selections from the allowed set and rejects others", () => {
    expect(
      parseAiPlanningGenerationInput(
        {
          preferred_travel_modes: ["walking"],
          arrival_hub_id: 7,
        },
        new Set([10]),
        new Set([7, 8]),
      ),
    ).toMatchObject({ arrival_hub_id: 7, departure_hub_id: null });

    expect(() =>
      parseAiPlanningGenerationInput(
        {
          preferred_travel_modes: ["walking"],
          departure_hub_id: 99,
        },
        new Set([10]),
        new Set([7, 8]),
      ),
    ).toThrow("Departure stop must be one of the destination's transit hubs.");
  });

  it("rejects malformed arrival and departure inputs", () => {
    expect(() =>
      parseAiPlanningGenerationInput(
        {
          preferred_travel_modes: ["walking"],
          arrival_time: "3pm",
        },
        new Set([10]),
      ),
    ).toThrow("Arrival time must be HH:MM.");

    expect(() =>
      parseAiPlanningGenerationInput(
        {
          preferred_travel_modes: ["walking"],
          departure_time: 900,
        },
        new Set([10]),
      ),
    ).toThrow("Departure time must be HH:MM.");

    expect(() =>
      parseAiPlanningGenerationInput(
        {
          preferred_travel_modes: ["walking"],
          departure_google_maps_url: 42,
        },
        new Set([10]),
      ),
    ).toThrow("Departure stop Google Maps URL must be a string.");
  });

  it("defaults the daily start time for generation and rejects malformed times", () => {
    expect(
      parseAiPlanningGenerationInput(
        {
          visits_per_day_min: 1,
          visits_per_day_max: 3,
          interest_tags: ["nature"],
          preferred_travel_modes: ["walking"],
          must_see_candidate_ids: [],
        },
        new Set([10]),
      ).daily_start_time,
    ).toBe("09:00");

    expect(() =>
      parseAiPlanningGenerationInput(
        {
          visits_per_day_min: 1,
          visits_per_day_max: 3,
          preferred_travel_modes: ["walking"],
          daily_start_time: "8:30",
        },
        new Set([10]),
      ),
    ).toThrow("Daily start time must be HH:MM.");
  });
});

describe("ai coverage planning helpers", () => {
  it("detects coverage trips when the minimum pace outgrows the catalog", () => {
    expect(isAiCoverageTrip(90, 2, 40)).toBe(true);
    expect(isAiCoverageTrip(21, 2, 40)).toBe(true);
    expect(isAiCoverageTrip(20, 2, 40)).toBe(false);
    expect(isAiCoverageTrip(0, 2, 40)).toBe(false);
  });

  it("floors coverage visits at the catalog fraction", () => {
    expect(aiCoverageMinTotalVisits(40)).toBe(32);
    expect(aiCoverageMinTotalVisits(12)).toBe(9);
  });

  it("sizes the sightseeing-day range from catalog size and pace", () => {
    expect(aiCoverageSightseeingDayRange(40, 2, 3)).toEqual({
      minDays: 14,
      maxDays: 20,
    });
    expect(aiCoverageSightseeingDayRange(40, 3, 5)).toEqual({
      minDays: 8,
      maxDays: 13,
    });
    // A fixed pace clamps the packed bound to the stretched bound: the final
    // partial day would fall below the minimum pace, so it is not counted.
    expect(aiCoverageSightseeingDayRange(40, 3, 3)).toEqual({
      minDays: 13,
      maxDays: 13,
    });
    expect(aiCoverageSightseeingDayRange(2, 3, 5)).toEqual({
      minDays: 1,
      maxDays: 1,
    });
  });
});

function setup(
  overrides: Partial<AiPlanningSetup> = {},
): AiPlanningSetup {
  return {
    trip: {
      id: 1,
      created_by: "user-1",
      name: "New York City",
      destination: "New York City",
      destination_slug: "new-york-city",
      destination_latitude: null,
      destination_longitude: null,
      destination_country_codes: null,
      destination_photo_url: null,
      destination_photo_attribution: null,
      start_date: "2026-05-27",
      end_date: "2026-05-29",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    candidatesReady: true,
    candidates: [
      {
        id: 10,
        destination_slug: "new-york-city",
        name: "Central Park",
        category: "park",
        tags: ["nature"],
        area: "Manhattan",
        region_distance_tier: "central",
        sort_order: 1,
        latitude: 40.78,
        longitude: -73.96,
        google_place_id: null,
        typical_duration_minutes: 180,
        indoor_outdoor: "outdoor",
        planning_note: null,
        blurb: null,
        image_url: null,
        image_credit: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    lodging: null,
    arrivalPoint: null,
    departurePoint: null,
    transitHubs: [],
    preferences: null,
    ...overrides,
  };
}
