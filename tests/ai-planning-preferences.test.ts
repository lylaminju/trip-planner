import { describe, expect, it } from "vitest";

import {
  AI_DEFAULT_PLANNING_PREFERENCES,
  buildAiPlanningPreferenceDraft,
} from "@/lib/ai-planning-preferences";
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
            visits_per_day_max: 4,
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
      visits_per_day_max: 4,
      interest_tags: ["nature", "museums"],
      preferred_travel_modes: ["walking"],
      must_see_candidate_ids: [10],
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
