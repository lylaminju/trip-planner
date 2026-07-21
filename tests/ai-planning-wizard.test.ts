import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AiPlanningWizard } from "@/components/AiPlanningWizard";
import {
  MustSeeStep,
  ReviewStep,
} from "@/components/ai-planning-wizard/AiPlanningWizardSteps";
import { LogisticsStep } from "@/components/ai-planning-wizard/LogisticsStep";
import { TransitStopsStep } from "@/components/ai-planning-wizard/TransitStopsStep";
import { transitStopPayload } from "@/components/ai-planning-wizard/transit-stop-draft";
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
        onRetryLoad: vi.fn(),
      }),
    );

    expect(markup).toContain("Preparing AI planner…");
    expect(markup).not.toContain("How full should each day feel?");
    expect(markup).not.toContain("Anything you can't miss?");
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
        onRetryLoad: vi.fn(),
      }),
    );

    expect(markup).toContain('class="modal ai-planning-modal"');
    expect(markup).toContain("Plan with AI");
    expect(markup).toContain("Step 1 of 6");
    expect(markup).not.toContain("New York City - ");
    expect(markup).not.toContain("2 curated attractions");
    expect(markup).toContain("How full should each day feel?");
    expect(markup).toContain("Relaxed");
    expect(markup).toContain("Balanced");
    expect(markup).toContain("Packed");
    // 2026-05-27 to 2026-05-29 inclusive = 3 days; ~((2+3)/2)*3 = 8 stops.
    expect(markup).toContain("May 27 – May 29");
    expect(markup).toContain("3 days");
    expect(markup).toContain("8 stops");
    expect(markup).toContain("across your 3 days");
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
        onRetryLoad: vi.fn(),
      }),
    );

    expect(markup).toContain('class="ai-generation-screen"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Creating itinerary");
    expect(markup).toContain('class="ai-generation-icons"');
    expect(markup).toContain("Building your New York City itinerary");
    expect(markup).not.toContain("Step 1 of 6");
    expect(markup).not.toContain("How full should each day feel?");
  });

  it("keeps the wizard form usable when generation fails so preferences are preserved", () => {
    const markup = renderToStaticMarkup(
      createElement(AiPlanningWizard, {
        setup: setup(),
        isLoading: false,
        error: "The AI planner couldn't create an itinerary.",
        isGenerating: false,
        onCancel: vi.fn(),
        onCreateItinerary: vi.fn(),
        onRetryLoad: vi.fn(),
      }),
    );

    // Form stays mounted (not a dead-end error screen) so the draft survives.
    expect(markup).toContain("Step 1 of 6");
    expect(markup).toContain("How full should each day feel?");
    expect(markup).not.toContain("ai-planning-status-error");
  });

  it("offers a retry action when setup fails to load", () => {
    const markup = renderToStaticMarkup(
      createElement(AiPlanningWizard, {
        setup: null,
        isLoading: false,
        error: "Failed to load AI planning setup.",
        isGenerating: false,
        onCancel: vi.fn(),
        onCreateItinerary: vi.fn(),
        onRetryLoad: vi.fn(),
      }),
    );

    expect(markup).toContain("Failed to load AI planning setup.");
    expect(markup).toContain("Try again");
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
          latitude: 40.758,
          longitude: -73.993,
          google_place_id: null,
          is_primary: true,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        tripId: 1,
        onChange: vi.fn(),
        onDailyStartTimeChange: vi.fn(),
        onLodgingGoogleMapsUrlChange: vi.fn(),
      }),
    );

    expect(markup).toContain("Travel modes");
    expect(markup).toContain("Daily start time");
    expect(markup).toContain('type="time"');
    expect(markup).toContain('value="08:30"');
    expect(markup).toContain("Where your days begin");
    expect(markup).toContain('type="url"');
    expect(markup).toContain("Pod Times Square");
  });

  it("renders hub chips and hides the saved stop note the selected chip duplicates", () => {
    const markup = renderToStaticMarkup(
      createElement(TransitStopsStep, {
        currentArrivalPoint: {
          id: 3,
          trip_id: 1,
          kind: "arrival",
          name: "JFK Airport",
          latitude: 40.641,
          longitude: -73.778,
          google_place_id: null,
          event_time: "15:30",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        currentDeparturePoint: null,
        transitDraft: {
          arrivalChoice: 71,
          arrivalUrl: "",
          arrivalTime: "15:30",
          departureChoice: "same",
          departureUrl: "",
          departureTime: "",
        },
        transitHubs: [
          {
            id: 71,
            destination_slug: "new-york-city",
            name: "John F. Kennedy International Airport",
            hub_type: "airport",
            iata_code: "JFK",
            latitude: 40.6413,
            longitude: -73.7781,
            sort_order: 1,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        tripId: 1,
        onTransitDraftChange: vi.fn(),
      }),
    );

    expect(markup).toContain("Where your trip starts");
    expect(markup).toContain("Arrival time");
    expect(markup).toContain("Where your trip ends");
    expect(markup).toContain("Departure time");
    expect(markup).toContain("JFK · John F. Kennedy International Airport");
    expect(markup).toContain("Somewhere else");
    expect(markup).toContain("Same as arrival");
    expect(markup).toContain('value="15:30"');
    // The selected chip already names the saved arrival stop, so the
    // current-stop note must stay hidden rather than repeat it.
    expect(markup).not.toContain("ai-transit-current");
    expect(markup).not.toContain("— optional");
  });

  it("shows the saved stop note when no hub chip is selected", () => {
    const markup = renderToStaticMarkup(
      createElement(TransitStopsStep, {
        currentArrivalPoint: {
          id: 3,
          trip_id: 1,
          kind: "arrival",
          name: "JFK Airport",
          latitude: 40.641,
          longitude: -73.778,
          google_place_id: null,
          event_time: "15:30",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        currentDeparturePoint: null,
        transitDraft: {
          arrivalChoice: null,
          arrivalUrl: "",
          arrivalTime: "",
          departureChoice: "same",
          departureUrl: "",
          departureTime: "",
        },
        transitHubs: [],
        tripId: 1,
        onTransitDraftChange: vi.fn(),
      }),
    );

    expect(markup).toContain("ai-transit-current");
    expect(markup).toContain("JFK Airport");
    expect(markup).toContain("15:30");
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
    expect(markup).not.toContain('aria-label="Clear selected must-sees"');
  });

  it("shows a Clear control only once must-sees are selected", () => {
    const markup = renderToStaticMarkup(
      createElement(MustSeeStep, {
        candidates: [candidate(10, "Central Park", "park", ["nature"], "Manhattan")],
        draft: { ...preferenceDraft(), must_see_candidate_ids: [10] },
        onChange: vi.fn(),
      }),
    );

    expect(markup).toContain("1 selected");
    expect(markup).toContain('aria-label="Clear selected must-sees"');
    expect(markup).toContain(">Clear</button>");
  });
});

/** Reads back the rendered value of a single review row by its label. */
function reviewRowValue(markup: string, label: string): string {
  const match = markup.match(
    new RegExp(
      `<span class="ai-review-label">${label}</span>` +
        `<span class="ai-review-value">([^<]*)</span>`,
    ),
  );
  return match?.[1] ?? "";
}

describe("ReviewStep", () => {
  it("shows the lodging name alongside the daily start time when set", () => {
    const markup = renderToStaticMarkup(
      createElement(ReviewStep, {
        arrivalCustomName: null,
        arrivalPointName: null,
        candidates: [],
        dailyStartTime: "08:30",
        days: 3,
        departureCustomName: null,
        departurePointName: null,
        draft: preferenceDraft(),
        lodgingName: "Pod Times Square",
        onEditStep: vi.fn(),
        transitDraft: {
          arrivalChoice: null,
          arrivalUrl: "",
          arrivalTime: "",
          departureChoice: null,
          departureUrl: "",
          departureTime: "",
        },
        transitHubs: [],
      }),
    );

    const dailyStart = reviewRowValue(markup, "Daily start");
    expect(dailyStart).toContain("Pod Times Square");
    expect(dailyStart).toContain("08:30");
  });

  it("shows resolved names for custom trip start and end links", () => {
    const markup = renderToStaticMarkup(
      createElement(ReviewStep, {
        arrivalCustomName: "Niagara Falls Terminal",
        arrivalPointName: null,
        candidates: [],
        dailyStartTime: "09:00",
        days: 3,
        departureCustomName: null,
        departurePointName: null,
        draft: preferenceDraft(),
        lodgingName: null,
        onEditStep: vi.fn(),
        transitDraft: {
          arrivalChoice: "custom",
          arrivalUrl: "https://maps.app.goo.gl/arrive",
          arrivalTime: "15:00",
          departureChoice: "custom",
          departureUrl: "https://maps.app.goo.gl/depart",
          departureTime: "",
        },
        transitHubs: [],
      }),
    );

    const tripStart = reviewRowValue(markup, "Trip start");
    expect(tripStart).toContain("Niagara Falls Terminal");
    expect(tripStart).toContain("15:00");
    // Departure link not resolved yet: falls back to the generic label.
    expect(reviewRowValue(markup, "Trip end")).toContain("From link");
  });
});

describe("transitStopPayload", () => {
  it("mirrors the arrival choice when departure is marked same as arrival", () => {
    expect(
      transitStopPayload({
        arrivalChoice: 71,
        arrivalUrl: "",
        arrivalTime: "15:00",
        departureChoice: "same",
        departureUrl: "",
        departureTime: "10:00",
      }),
    ).toEqual({
      arrival_hub_id: 71,
      arrival_google_maps_url: null,
      arrival_time: "15:00",
      departure_hub_id: 71,
      departure_google_maps_url: null,
      departure_time: "10:00",
    });
  });

  it("sends the custom link only for the side that selected it", () => {
    expect(
      transitStopPayload({
        arrivalChoice: "custom",
        arrivalUrl: " https://maps.app.goo.gl/arrive ",
        arrivalTime: "",
        departureChoice: 72,
        departureUrl: "https://maps.app.goo.gl/stale",
        departureTime: "",
      }),
    ).toEqual({
      arrival_hub_id: null,
      arrival_google_maps_url: "https://maps.app.goo.gl/arrive",
      arrival_time: null,
      departure_hub_id: 72,
      departure_google_maps_url: null,
      departure_time: null,
    });
  });
});

describe("formatVisitsPerDayRangeLabel", () => {
  it("formats collapsed and expanded visit ranges", () => {
    expect(formatVisitsPerDayRangeLabel(2, 3)).toBe("2-3 visits/day");
    expect(formatVisitsPerDayRangeLabel(3, 3)).toBe("3 visits/day");
  });
});

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
    isSupportedDestination: true,
    candidates: [
      candidate(10, "Central Park", "park", ["nature"], "Manhattan"),
      candidate(11, "The Met", "museum", ["museums"], "Upper East Side"),
    ],
    lodging: null,
    arrivalPoint: null,
    departurePoint: null,
    transitHubs: [],
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
    blurb: null,
    image_url: null,
    image_credit: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}
