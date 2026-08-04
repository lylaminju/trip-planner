import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AiPlanningWizard } from "@/components/AiPlanningWizard";
import {
  InterestStep,
  MustSeeStep,
  PaceStep,
  ReviewStep,
} from "@/components/ai-planning-wizard/AiPlanningWizardSteps";
import { LogisticsStep } from "@/components/ai-planning-wizard/LogisticsStep";
import { TransitStopsStep } from "@/components/ai-planning-wizard/TransitStopsStep";
import {
  transitStopPayload,
  type TransitStopDraft,
} from "@/components/ai-planning-wizard/transit-stop-draft";
import { cycleInterestTag } from "@/components/ai-planning-wizard/toggle-value";
import {
  AI_WIZARD_LAST_STEP_INDEX,
  AI_WIZARD_STEPS,
  aiWizardStepIndex,
} from "@/components/ai-planning-wizard/wizard-steps";
import {
  AI_DEFAULT_DAILY_START_TIME,
  formatVisitsPerDayRangeLabel,
} from "@/lib/ai-planning-preferences";
import type { AiPlanningPreferenceInput, AiPlanningSetup } from "@/lib/types";

describe("AiPlanningWizard", () => {
  it("shows one loading state while setup data is loading", () => {
    const markup = renderToStaticMarkup(
      createElement(AiPlanningWizard, {
        setup: null,
        isLoading: true,
        catalogStatus: "ready",
        hubsStatus: "ready",
        onRetryCatalogPrepare: vi.fn(),
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
        catalogStatus: "ready",
        hubsStatus: "ready",
        onRetryCatalogPrepare: vi.fn(),
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
    // 3 trip days at the default 2-3/day pace exceed the 2-candidate catalog,
    // so the estimate shows coverage copy: catalog-sized stops plus free days.
    expect(markup).toContain("May 27 – May 29");
    expect(markup).toContain("3-day trip");
    expect(markup).toContain("2 stops");
    expect(markup).toContain("the rest are free days");
    expect(markup).toContain("Next");
  });

  it("shows the full-trip stop estimate when the catalog can fill every day", () => {
    const markup = renderToStaticMarkup(
      createElement(PaceStep, {
        draft: preferenceDraft(),
        onChange: vi.fn(),
        days: 3,
        candidateCount: 40,
      }),
    );

    // 3 days at 2-3/day: ~((2+3)/2)*3 = 8 stops.
    expect(markup).toContain("8 stops");
    expect(markup).toContain("across your 3 days");
    expect(markup).not.toContain("free days");
  });

  it("shows sightseeing days plus free days when the trip outgrows the catalog", () => {
    const markup = renderToStaticMarkup(
      createElement(PaceStep, {
        draft: preferenceDraft(),
        onChange: vi.fn(),
        days: 90,
        candidateCount: 40,
      }),
    );

    // 40 candidates at 2-3/day: ceil(40/3)=14 to floor(40/2)=20 sightseeing days.
    expect(markup).toContain("40 stops");
    expect(markup).toContain("14–20 sightseeing days");
    expect(markup).toContain("the rest are free days");
  });

  it("replaces wizard body with the generation screen while generating", () => {
    const markup = renderToStaticMarkup(
      createElement(AiPlanningWizard, {
        setup: setup(),
        isLoading: false,
        catalogStatus: "ready",
        hubsStatus: "ready",
        onRetryCatalogPrepare: vi.fn(),
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
    expect(markup).toContain('class="ai-generation-spotlight"');
    expect(markup).toContain("Building your New York City itinerary");
    expect(markup).not.toContain("Step 1 of 6");
    expect(markup).not.toContain("How full should each day feel?");
  });

  it("keeps the wizard form usable when generation fails so preferences are preserved", () => {
    const markup = renderToStaticMarkup(
      createElement(AiPlanningWizard, {
        setup: setup(),
        isLoading: false,
        catalogStatus: "ready",
        hubsStatus: "ready",
        onRetryCatalogPrepare: vi.fn(),
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
        catalogStatus: "ready",
        hubsStatus: "ready",
        onRetryCatalogPrepare: vi.fn(),
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

  it("keeps the required logistics step free of blank-able optional fields", () => {
    const markup = renderToStaticMarkup(
      createElement(LogisticsStep, {
        draft: preferenceDraft(),
        dailyStartTime: "08:30",
        onChange: vi.fn(),
        onDailyStartTimeChange: vi.fn(),
      }),
    );

    expect(markup).toContain("Travel modes");
    expect(markup).toContain("Daily start time");
    expect(markup).toContain('type="time"');
    expect(markup).toContain('value="08:30"');
    // The step carries the Optional badge's opposite: every control here is
    // either required or pre-filled, so the lodging search must live on the
    // optional Start & end step instead.
    expect(markup).not.toContain("Where your days begin");
    expect(markup).not.toContain('role="combobox"');
  });

  it("renders the optional start-of-day field on the start & end step", () => {
    const markup = renderToStaticMarkup(
      createElement(TransitStopsStep, {
        ...transitStepProps(),
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
      }),
    );

    expect(markup).toContain("Where your days begin");
    // The field is a place-search combobox that also accepts a pasted link.
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain("paste a Google Maps link");
    expect(markup).toContain("Pod Times Square");
  });

  it("makes the start-of-day field paste-only for guests who can't run live search", () => {
    const markup = renderToStaticMarkup(
      createElement(TransitStopsStep, {
        ...transitStepProps(),
        isGuest: true,
      }),
    );

    // Guests can't reach live Google search, so the field must not advertise a
    // search box that dead-ends; it steers them to pasting a link and says how
    // live search is unlocked.
    expect(markup).toContain('placeholder="Paste a Google Maps link"');
    expect(markup).toContain("Google search needs a sign-in");
    expect(markup).not.toContain("Search a place");
  });

  it("renders hub chips and hides the saved stop note the selected chip duplicates", () => {
    const markup = renderToStaticMarkup(
      createElement(TransitStopsStep, {
        ...transitStepProps(),
        currentArrivalPoint: {
          id: 3,
          trip_id: 1,
          kind: "arrival",
          name: "JFK Airport",
          latitude: 40.641,
          longitude: -73.778,
          google_place_id: null,
          hub_type: "airport",
          event_time: "15:30",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
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
        ...transitStepProps(),
        currentArrivalPoint: {
          id: 3,
          trip_id: 1,
          kind: "arrival",
          name: "JFK Airport",
          latitude: 40.641,
          longitude: -73.778,
          google_place_id: null,
          hub_type: "airport",
          event_time: "15:30",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      }),
    );

    expect(markup).toContain("ai-transit-current");
    expect(markup).toContain("JFK Airport");
    expect(markup).toContain("15:30");
  });

  it("renders a place-search combobox for a custom transit stop", () => {
    const markup = renderToStaticMarkup(
      createElement(TransitStopsStep, {
        ...transitStepProps(),
        transitDraft: {
          arrivalChoice: "custom",
          arrivalUrl: "",
          arrivalTime: "",
          departureChoice: "same",
          departureUrl: "",
          departureTime: "",
        },
      }),
    );

    // The custom-stop input is now a searchable combobox, not a paste-only URL.
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain("paste a Google Maps link");
  });

  it("shows candidate planning notes on the must-see step", () => {
    const markup = renderToStaticMarkup(
      createElement(MustSeeStep, {
        catalogStatus: "ready" as const,
        onRetryPrepare: vi.fn(),
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

  it("shows a centered animated pending state while the catalog prepares", () => {
    const markup = renderToStaticMarkup(
      createElement(MustSeeStep, {
        catalogStatus: "preparing" as const,
        onRetryPrepare: vi.fn(),
        candidates: [],
        draft: preferenceDraft(),
        onChange: vi.fn(),
      }),
    );

    expect(markup).toContain('class="ai-step-pending-screen"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Finding top attractions…");
    expect(markup).toContain('class="ai-step-pending-icon"');
  });

  it("offers a retry when catalog preparation failed", () => {
    const onRetryPrepare = vi.fn();
    const markup = renderToStaticMarkup(
      createElement(MustSeeStep, {
        catalogStatus: "error" as const,
        onRetryPrepare,
        candidates: [],
        draft: preferenceDraft(),
        onChange: vi.fn(),
      }),
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('class="ai-step-retry"');
    expect(markup).toContain("Try again");
  });

  it("shows a Clear control only once must-sees are selected", () => {
    const markup = renderToStaticMarkup(
      createElement(MustSeeStep, {
        catalogStatus: "ready" as const,
        onRetryPrepare: vi.fn(),
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

describe("InterestStep", () => {
  it("renders one chip list with distinct chosen and skipped states", () => {
    const markup = renderToStaticMarkup(
      createElement(InterestStep, {
        draft: {
          ...preferenceDraft(),
          interest_tags: ["food"],
          avoid_interest_tags: ["shopping"],
        },
        onChange: vi.fn(),
      }),
    );

    // A single tri-state list: chosen chips read as pressed, skipped chips as
    // mixed, and the header counts both plus a shared Clear affordance.
    expect(markup).toContain("1 chosen · 1 skipped");
    expect(markup).toContain('class="ai-chip selected"');
    expect(markup).toContain('class="ai-chip avoided"');
    expect(markup).toContain('aria-pressed="mixed"');
    expect(markup).toContain('aria-label="Shopping — skipped"');
    expect(markup).toContain('aria-label="Clear interests"');
  });
});

describe("cycleInterestTag", () => {
  it("cycles a tag through chosen, skipped, and neutral without overlap", () => {
    const neutral = { interest_tags: [], avoid_interest_tags: [] };

    const chosen = cycleInterestTag(neutral, "food");
    expect(chosen).toEqual({
      interest_tags: ["food"],
      avoid_interest_tags: [],
    });

    const skipped = cycleInterestTag(chosen, "food");
    expect(skipped).toEqual({
      interest_tags: [],
      avoid_interest_tags: ["food"],
    });

    expect(cycleInterestTag(skipped, "food")).toEqual(neutral);
  });

  it("leaves other tags in place while one cycles", () => {
    expect(
      cycleInterestTag(
        { interest_tags: ["nature"], avoid_interest_tags: ["shopping"] },
        "nature",
      ),
    ).toEqual({
      interest_tags: [],
      avoid_interest_tags: ["shopping", "nature"],
    });
  });
});

describe("ReviewStep", () => {
  it("adds a Skipping row only when interests are avoided", () => {
    const baseProps = {
      arrivalCustomName: null,
      arrivalPointName: null,
      candidates: [],
      dailyStartTime: "09:00",
      days: 3,
      departureCustomName: null,
      departurePointName: null,
      lodgingName: null,
      onEditStep: vi.fn(),
      transitDraft: {
        arrivalChoice: null,
        arrivalUrl: "",
        arrivalTime: "",
        departureChoice: null,
        departureUrl: "",
        departureTime: "",
      } satisfies TransitStopDraft,
      transitHubs: [],
    };

    const withAvoided = renderToStaticMarkup(
      createElement(ReviewStep, {
        ...baseProps,
        draft: { ...preferenceDraft(), avoid_interest_tags: ["shopping"] },
      }),
    );
    expect(reviewRowValue(withAvoided, "Skipping")).toBe("Shopping");

    const withoutAvoided = renderToStaticMarkup(
      createElement(ReviewStep, { ...baseProps, draft: preferenceDraft() }),
    );
    expect(reviewRowValue(withoutAvoided, "Skipping")).toBe("");
  });

  it("splits the home base and daily start rows so each edits its own step", () => {
    const markup = renderToStaticMarkup(
      createElement(ReviewStep, {
        arrivalCustomName: null,
        arrivalPointName: null,
        candidates: [],
        days: 3,
        departureCustomName: null,
        departurePointName: null,
        draft: { ...preferenceDraft(), daily_start_time: "08:30" },
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

    // Lodging moved to the optional Start & end step, so it can no longer share
    // a row with the required step's daily start time — each row's Edit button
    // has to land on the step that actually owns the field.
    expect(reviewRowValue(markup, "Daily start")).toContain("08:30");
    expect(reviewRowValue(markup, "Home base")).toContain("Pod Times Square");
  });

  it("shows resolved names for custom trip start and end links", () => {
    const markup = renderToStaticMarkup(
      createElement(ReviewStep, {
        arrivalCustomName: "Niagara Falls Terminal",
        arrivalPointName: null,
        candidates: [],
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

describe("AI_WIZARD_STEPS", () => {
  it("keeps every optional step in one run after the required steps", () => {
    const optionalRunStart = AI_WIZARD_STEPS.findIndex(
      (step) => step.optional === true,
    );
    const betweenOptionalAndReview = AI_WIZARD_STEPS.slice(
      optionalRunStart,
      AI_WIZARD_LAST_STEP_INDEX,
    );

    // "Skip to review" is a single jump from any optional step to the last one.
    // A required step sitting inside that run would be silently skipped, so the
    // optional steps must stay contiguous and review must stay last.
    expect(optionalRunStart).toBeGreaterThan(0);
    expect(
      betweenOptionalAndReview.every((step) => step.optional === true),
    ).toBe(true);
    expect(AI_WIZARD_STEPS[AI_WIZARD_LAST_STEP_INDEX].key).toBe("review");
  });

  it("gates travel modes on a required step ahead of the skippable run", () => {
    // Empty travel modes are the wizard's only hard submit block, so the step
    // owning them has to be answered before skipping becomes reachable.
    expect(AI_WIZARD_STEPS[aiWizardStepIndex("logistics")].optional).toBe(
      undefined,
    );
    expect(aiWizardStepIndex("logistics")).toBeLessThan(
      AI_WIZARD_STEPS.findIndex((step) => step.optional === true),
    );
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

/** Baseline props for the start & end step; tests override only what they assert. */
function transitStepProps() {
  return {
    currentArrivalPoint: null,
    currentDeparturePoint: null,
    currentLodging: null,
    destinationBias: { latitude: 40.7128, longitude: -74.006 },
    destinationCountryCodes: ["US"],
    hubsStatus: "ready" as const,
    lodgingGoogleMapsUrl: "",
    onLodgingGoogleMapsUrlChange: vi.fn(),
    onRetryPrepare: vi.fn(),
    onTransitDraftChange: vi.fn(),
    transitDraft: {
      arrivalChoice: null,
      arrivalUrl: "",
      arrivalTime: "",
      departureChoice: "same",
      departureUrl: "",
      departureTime: "",
    } satisfies TransitStopDraft,
    transitHubs: [],
    tripId: 1,
  };
}

function preferenceDraft(): AiPlanningPreferenceInput {
  return {
    visits_per_day_min: 2,
    visits_per_day_max: 3,
    interest_tags: [],
    avoid_interest_tags: [],
    preferred_travel_modes: ["walking", "transit"],
    must_see_candidate_ids: [],
    daily_start_time: AI_DEFAULT_DAILY_START_TIME,
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
    candidatesReady: true,
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
