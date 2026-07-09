import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AiPlanningWizard } from "@/components/AiPlanningWizard";
import {
  LogisticsStep,
  MustSeeStep,
} from "@/components/ai-planning-wizard/AiPlanningWizardSteps";
import { formatVisitsPerDayRangeLabel } from "@/lib/ai-planning-preferences";
import type { AiPlanningPreferenceInput, AiPlanningSetup } from "@/lib/types";

describe("AiPlanningWizard", () => {
  it("shows one loading state while setup data is loading", () => {
    const markup = renderToStaticMarkup(
      createElement(AiPlanningWizard, {
        setup: null,
        isLoading: true,
        error: null,
        isGenerating: false,
        onCancel: vi.fn(),
        onCreateItinerary: vi.fn(),
      }),
    );

    expect(markup).toContain("Preparing AI planner...");
    expect(markup).not.toContain("Visits per day");
    expect(markup).not.toContain("Must-see attractions");
  });

  it("renders the first wizard step without a destination summary subtitle", () => {
    const markup = renderToStaticMarkup(
      createElement(AiPlanningWizard, {
        setup: setup(),
        isLoading: false,
        error: null,
        isGenerating: false,
        onCancel: vi.fn(),
        onCreateItinerary: vi.fn(),
      }),
    );

    expect(markup).toContain('class="modal ai-planning-modal"');
    expect(markup).toContain("Plan with AI");
    expect(markup).toContain("Step 1 of 4");
    expect(markup).not.toContain("New York City - ");
    expect(markup).not.toContain("2 curated attractions");
    expect(markup).toContain("Visits per day");
    expect(markup).toContain("2-3 visits/day");
    expect(markup).toContain('aria-label="Visits per day range"');
    expect(markup).toContain('aria-label="Minimum visits per day, 2"');
    expect(markup).toContain('aria-label="Maximum visits per day, 3"');
    expect(countOccurrences(markup, 'class="ai-range-slider-track"')).toBe(1);
    expect(markup).toContain(
      'class="ai-range-tick" style="--ai-range-position:100%">5</span>',
    );
    expect(markup).toContain("Next");
  });

  it("replaces wizard body with centered loading icons while generating", () => {
    const markup = renderToStaticMarkup(
      createElement(AiPlanningWizard, {
        setup: setup(),
        isLoading: false,
        error: null,
        isGenerating: true,
        onCancel: vi.fn(),
        onCreateItinerary: vi.fn(),
      }),
    );

    expect(markup).toContain('class="ai-generation-loading"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Creating itinerary");
    expect(markup).toContain('class="ai-generation-icons"');
    expect(markup).not.toContain("Step 1 of 4");
    expect(markup).not.toContain("Visits per day");
    expect(markup).not.toContain("Creating...");
  });

  it("renders an optional lodging Google Maps URL on the logistics step", () => {
    const markup = renderToStaticMarkup(
      createElement(LogisticsStep, {
        draft: preferenceDraft(),
        dailyStartTime: "08:30",
        lodgingGoogleMapsUrl: "",
        currentLodging: {
          id: 2,
          trip_id: 1,
          name: "Pod Times Square",
          address: "400 W 42nd St",
          latitude: 40.758,
          longitude: -73.993,
          google_place_id: null,
          check_in_date: null,
          check_out_date: null,
          is_primary: true,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        onChange: vi.fn(),
        onDailyStartTimeChange: vi.fn(),
        onLodgingGoogleMapsUrlChange: vi.fn(),
      }),
    );

    expect(markup).toContain("Preferred travel modes");
    expect(markup).toContain("Daily start time");
    expect(markup).toContain('type="time"');
    expect(markup).toContain('value="08:30"');
    expect(markup).toContain("Lodging Google Maps URL");
    expect(markup).toContain('type="url"');
    expect(markup).toContain("Pod Times Square");
  });

  it("shows candidate planning notes on the must-see step", () => {
    const markup = renderToStaticMarkup(
      createElement(MustSeeStep, {
        candidates: [
          {
            ...candidate(
              12,
              "Village Vanguard",
              "jazz_club",
              ["landmarks"],
              "Greenwich Village",
            ),
            planning_note: "Online booking recommended.",
          },
        ],
        draft: preferenceDraft(),
        onChange: vi.fn(),
      }),
    );

    expect(markup).toContain("Village Vanguard");
    expect(markup).toContain("Online booking recommended.");
  });
});

describe("formatVisitsPerDayRangeLabel", () => {
  it("formats collapsed and expanded visit ranges", () => {
    expect(formatVisitsPerDayRangeLabel(2, 3)).toBe("2-3 visits/day");
    expect(formatVisitsPerDayRangeLabel(3, 3)).toBe("3 visits/day");
  });
});

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

function preferenceDraft(): AiPlanningPreferenceInput {
  return {
    visits_per_day_min: 2,
    visits_per_day_max: 3,
    interest_tags: [],
    preferred_travel_modes: ["walking", "transit"],
    must_see_candidate_ids: [],
  };
}

function setup(): AiPlanningSetup {
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
      candidate(10, "Central Park", "park", ["nature"], "Manhattan"),
      candidate(11, "The Met", "museum", ["museums"], "Upper East Side"),
    ],
    lodging: null,
    preferences: null,
  };
}

function candidate(
  id: number,
  name: string,
  category: string,
  tags: string[],
  area: string,
) {
  return {
    id,
    destination_slug: "new-york-city",
    name,
    category,
    tags,
    area,
    region_distance_tier: "central" as const,
    sort_order: id,
    latitude: 40,
    longitude: -74,
    google_place_id: null,
    typical_duration_minutes: 120,
    indoor_outdoor: "mixed" as const,
    planning_note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}
