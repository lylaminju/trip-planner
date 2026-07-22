import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiPlanningPreferenceInput } from "@/lib/types";
import {
  generateAiItinerary,
  loadAiPlanningSetup,
  prepareAiDestinationCatalog,
  prepareAiDestinationTransitHubs,
  saveAiPlanningPreferences,
} from "@/lib/planner-api";

describe("planner api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads AI planning setup from the trip scoped endpoint", async () => {
    const setup = {
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
      candidatesReady: true,
      candidates: [],
      lodging: null,
      preferences: null,
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(setup));

    await expect(loadAiPlanningSetup(1)).resolves.toEqual(setup);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trips/1/ai-planning/setup",
    );
  });

  it("normalizes failed AI setup responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    await expect(loadAiPlanningSetup(1)).rejects.toThrow(
      "Failed to load AI planning setup.",
    );
  });

  it("saves AI planning preferences to the trip scoped endpoint", async () => {
    const preferences = {
      trip_id: 1,
      visits_per_day_min: 1,
      visits_per_day_max: 3,
      interest_tags: ["nature"],
      preferred_travel_modes: ["walking", "transit"],
      must_see_candidate_ids: [10],
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const input: AiPlanningPreferenceInput = {
      visits_per_day_min: 1,
      visits_per_day_max: 3,
      interest_tags: ["nature"],
      preferred_travel_modes: ["walking", "transit"],
      must_see_candidate_ids: [10],
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(preferences));

    await expect(saveAiPlanningPreferences(1, input)).resolves.toEqual(
      preferences,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trips/1/ai-planning/preferences",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
  });

  it("generates an AI itinerary from the trip scoped endpoint", async () => {
    const input: AiPlanningPreferenceInput = {
      visits_per_day_min: 1,
      visits_per_day_max: 3,
      interest_tags: ["nature"],
      preferred_travel_modes: ["walking", "transit"],
      must_see_candidate_ids: [10],
    };
    const result = {
      generationId: 55,
      plannerSnapshot: {
        places: [],
        itineraryItems: [],
        routeSegments: [],
      },
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(result));

    await expect(generateAiItinerary(1, input)).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trips/1/ai-planning/generate",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
  });

  it("prepares the destination catalog and surfaces the server error message", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { error: "Daily AI generation limit reached. Please try again tomorrow." },
        { status: 429 },
      ),
    );

    await expect(prepareAiDestinationCatalog(1)).rejects.toThrow(
      "Daily AI generation limit reached. Please try again tomorrow.",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trips/1/ai-planning/candidates",
      { method: "POST" },
    );
  });

  it("prepares transit hubs via the trip scoped endpoint", async () => {
    const transitHubs = [{ id: 5, name: "Lisbon Airport" }];
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ transitHubs }));

    await expect(prepareAiDestinationTransitHubs(1)).resolves.toEqual(
      transitHubs,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trips/1/ai-planning/transit-hubs",
      { method: "POST" },
    );
  });

  it("falls back to a readable message when hub preparation returns an empty body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    await expect(prepareAiDestinationTransitHubs(1)).rejects.toThrow(
      "Failed to prepare transit stops.",
    );
  });

  it("falls back to a readable message when catalog preparation returns an empty body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    await expect(prepareAiDestinationCatalog(1)).rejects.toThrow(
      "Failed to prepare destination suggestions.",
    );
  });

  it("falls back to a readable message when itinerary generation returns an empty body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    await expect(
      generateAiItinerary(1, {
        visits_per_day_min: 1,
        visits_per_day_max: 3,
        interest_tags: [],
        preferred_travel_modes: ["walking"],
        must_see_candidate_ids: [],
      }),
    ).rejects.toThrow("Failed to generate AI itinerary.");
  });
});
