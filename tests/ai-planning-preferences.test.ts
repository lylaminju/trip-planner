import { describe, expect, it } from "vitest";

import {
  AI_DEFAULT_PLANNING_PREFERENCES,
  buildAiPlanningPreferenceDraft,
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
    });
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
      start_date: "2026-05-27",
      end_date: "2026-05-29",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    isSupportedDestination: true,
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
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    lodging: null,
    preferences: null,
    ...overrides,
  };
}
