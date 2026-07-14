import { describe, expect, it, vi } from "vitest";

import {
  aiPlannerResult,
  candidateRecord,
  membership,
  savedPreferenceRecord,
  transitHubRecord,
  transitPointRecord,
  tripRecord,
  withMockedAiPlanningService,
} from "./ai-planning-service.test-helpers";

describe("ai-planning-service request boundary", () => {
  it("requires owner access and returns empty-catalog setup data for supported destinations", async () => {
    const trip = tripRecord({ destination_slug: "new-york-city" });
    const requireTripRole = vi.fn().mockResolvedValue(membership("owner"));
    const getTripById = vi.fn().mockResolvedValue(trip);
    const listDestinationCandidates = vi.fn().mockResolvedValue([]);
    const getPrimaryLodging = vi.fn().mockResolvedValue(null);
    const getPlanningPreferences = vi.fn().mockResolvedValue(null);

    await withMockedAiPlanningService(
      {
        getTripById,
        requireTripRole,
        supabaseAiPlanningService: {
          listDestinationCandidates,
          getPrimaryLodging,
          getPlanningPreferences,
        },
      },
      async ({ service }) => {
        await expect(
          service.getAiPlanningSetupForRequest(1, "user-1"),
        ).resolves.toEqual({
          trip,
          isSupportedDestination: true,
          candidates: [],
          lodging: null,
          arrivalPoint: null,
          departurePoint: null,
          transitHubs: [],
          preferences: null,
        });
      },
    );

    expect(requireTripRole).toHaveBeenCalledWith(1, "user-1", "owner");
    expect(getTripById).toHaveBeenCalledWith(1);
    expect(listDestinationCandidates).toHaveBeenCalledWith("new-york-city");
    expect(getPrimaryLodging).toHaveBeenCalledWith(1);
    expect(getPlanningPreferences).toHaveBeenCalledWith(1);
  });

  it("returns unsupported setup without reading AI planning tables", async () => {
    const trip = tripRecord({ destination_slug: "montreal" });
    const requireTripRole = vi.fn().mockResolvedValue(membership("owner"));
    const getTripById = vi.fn().mockResolvedValue(trip);
    const listDestinationCandidates = vi.fn();
    const getPrimaryLodging = vi.fn();
    const getPlanningPreferences = vi.fn();

    await withMockedAiPlanningService(
      {
        getTripById,
        requireTripRole,
        supabaseAiPlanningService: {
          listDestinationCandidates,
          getPrimaryLodging,
          getPlanningPreferences,
        },
      },
      async ({ service }) => {
        await expect(
          service.getAiPlanningSetupForRequest(1, "user-1"),
        ).resolves.toEqual({
          trip,
          isSupportedDestination: false,
          candidates: [],
          lodging: null,
          arrivalPoint: null,
          departurePoint: null,
          transitHubs: [],
          preferences: null,
        });
      },
    );

    expect(requireTripRole).toHaveBeenCalledWith(1, "user-1", "owner");
    expect(listDestinationCandidates).not.toHaveBeenCalled();
    expect(getPrimaryLodging).not.toHaveBeenCalled();
    expect(getPlanningPreferences).not.toHaveBeenCalled();
  });

  it("saves owner preferences constrained to the curated destination candidates", async () => {
    const trip = tripRecord({ destination_slug: "new-york-city" });
    const requireTripRole = vi.fn().mockResolvedValue(membership("owner"));
    const getTripById = vi.fn().mockResolvedValue(trip);
    const listDestinationCandidates = vi.fn().mockResolvedValue([
      candidateRecord(10),
      candidateRecord(11),
    ]);
    const saved = {
      trip_id: 1,
      visits_per_day_min: 1,
      visits_per_day_max: 3,
      interest_tags: ["nature"],
      preferred_travel_modes: ["walking", "transit"],
      must_see_candidate_ids: [10],
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const upsertPlanningPreferences = vi.fn().mockResolvedValue(saved);

    await withMockedAiPlanningService(
      {
        getTripById,
        requireTripRole,
        supabaseAiPlanningService: {
          listDestinationCandidates,
          upsertPlanningPreferences,
        },
      },
      async ({ service }) => {
        await expect(
          service.saveAiPlanningPreferencesForRequest(1, "user-1", {
            visits_per_day_min: 1,
            visits_per_day_max: 3,
            interest_tags: ["nature"],
            preferred_travel_modes: ["walking", "transit"],
            must_see_candidate_ids: [10],
          }),
        ).resolves.toEqual(saved);
      },
    );

    expect(requireTripRole).toHaveBeenCalledWith(1, "user-1", "owner");
    expect(getTripById).toHaveBeenCalledWith(1);
    expect(listDestinationCandidates).toHaveBeenCalledWith("new-york-city");
    expect(upsertPlanningPreferences).toHaveBeenCalledWith(1, {
      visits_per_day_min: 1,
      visits_per_day_max: 3,
      interest_tags: ["nature"],
      preferred_travel_modes: ["walking", "transit"],
      must_see_candidate_ids: [10],
    });
  });

  it("rejects must-see IDs outside the curated destination candidates", async () => {
    await withMockedAiPlanningService(
      {
        supabaseAiPlanningService: {
          listDestinationCandidates: vi.fn().mockResolvedValue([
            candidateRecord(10),
          ]),
          upsertPlanningPreferences: vi.fn(),
        },
      },
      async ({ service }) => {
        await expect(
          service.saveAiPlanningPreferencesForRequest(1, "user-1", {
            visits_per_day_min: 1,
            visits_per_day_max: 3,
            interest_tags: ["nature"],
            preferred_travel_modes: ["walking", "transit"],
            must_see_candidate_ids: [99],
          }),
        ).rejects.toThrow(
          "Must-see selections must come from the curated candidate list.",
        );
      },
    );
  });

  it("generates, repairs once, logs, and applies a validated AI itinerary", async () => {
    const requireTripRole = vi.fn().mockResolvedValue(membership("owner"));
    const getTripById = vi.fn().mockResolvedValue(
      tripRecord({
        start_date: "2026-05-27",
        end_date: "2026-05-27",
      }),
    );
    const listDestinationCandidates = vi.fn().mockResolvedValue([
      candidateRecord(10),
    ]);
    const savedPreferences = savedPreferenceRecord({
      visits_per_day_min: 1,
      visits_per_day_max: 3,
      interest_tags: ["landmarks"],
      preferred_travel_modes: ["walking", "transit"],
      must_see_candidate_ids: [10],
    });
    const upsertPlanningPreferences = vi
      .fn()
      .mockResolvedValue(savedPreferences);
    const requestAiItineraryPlan = vi
      .fn()
      .mockResolvedValueOnce(aiPlannerResult(99, 10, 20))
      .mockResolvedValueOnce(aiPlannerResult(10, 11, 21));
    const createAiPlanGeneration = vi.fn().mockResolvedValue({ id: 55 });
    const updateAiPlanGeneration = vi.fn();
    const plannerSnapshot = { places: [], itineraryItems: [], routeSegments: [] };
    const replaceAiGeneratedBatch = vi.fn().mockResolvedValue(plannerSnapshot);

    await withMockedAiPlanningService(
      {
        getTripById,
        requireTripRole,
        supabaseAiPlanningService: {
          listDestinationCandidates,
          getPrimaryLodging: vi.fn().mockResolvedValue(null),
          upsertPlanningPreferences,
        },
        aiPlanner: { requestAiItineraryPlan },
        aiPlanApplication: {
          createAiPlanGeneration,
          updateAiPlanGeneration,
          replaceAiGeneratedBatch,
        },
      },
      async ({ service }) => {
        await expect(
          service.generateAiItineraryForRequest(1, "user-1", {
            visits_per_day_min: 1,
            visits_per_day_max: 3,
            interest_tags: ["landmarks"],
            preferred_travel_modes: ["walking", "transit"],
            must_see_candidate_ids: [10],
            daily_start_time: "08:30",
          }),
        ).resolves.toEqual({ generationId: 55, plannerSnapshot });
      },
      { openAiApiKey: "test-key", openAiModel: "gpt-5-mini-test" },
    );

    expect(requestAiItineraryPlan).toHaveBeenCalledTimes(2);
    expect(requestAiItineraryPlan.mock.calls[0][0].model).toBe(
      "gpt-5-mini-test",
    );
    expect(requestAiItineraryPlan.mock.calls[1][0].context.validationErrors).toContain(
      "Candidate 99 is not in the curated list.",
    );
    expect(requestAiItineraryPlan.mock.calls[1][0].context.validationErrors).toContain(
      "Must-see candidate 10 is missing from the plan.",
    );
    expect(requestAiItineraryPlan.mock.calls[0][0].context.daily_start_time).toBe(
      "08:30",
    );
    expect(replaceAiGeneratedBatch).toHaveBeenCalledWith(
      1,
      55,
      expect.any(Object),
      [candidateRecord(10)],
      savedPreferences,
      null,
      "08:30",
      "user-1",
      null,
      null,
    );
    expect(updateAiPlanGeneration).toHaveBeenLastCalledWith(
      55,
      expect.objectContaining({
        status: "completed",
        repair_attempted: true,
        repair_validation_status: "valid",
        generated_place_count: 1,
        generated_day_count: 1,
      }),
    );
  });

  it("uses a submitted lodging Google Maps URL as the AI planning start anchor", async () => {
    const requireTripRole = vi.fn().mockResolvedValue(membership("owner"));
    const getTripById = vi.fn().mockResolvedValue(
      tripRecord({
        start_date: "2026-05-27",
        end_date: "2026-05-27",
      }),
    );
    const listDestinationCandidates = vi.fn().mockResolvedValue([
      candidateRecord(10),
    ]);
    const savedPreferences = savedPreferenceRecord({
      visits_per_day_min: 1,
      visits_per_day_max: 3,
      preferred_travel_modes: ["walking"],
      must_see_candidate_ids: [10],
    });
    const lodging = {
      id: 7,
      trip_id: 1,
      name: "Pod Times Square",
      latitude: 40.758,
      longitude: -73.993,
      google_place_id: null,
      is_primary: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const upsertPlanningPreferences = vi
      .fn()
      .mockResolvedValue(savedPreferences);
    const upsertPrimaryLodgingFromGoogleMapsUrl = vi
      .fn()
      .mockResolvedValue(lodging);
    const requestAiItineraryPlan = vi
      .fn()
      .mockResolvedValue(aiPlannerResult(10, 10, 20));
    const createAiPlanGeneration = vi.fn().mockResolvedValue({ id: 55 });
    const updateAiPlanGeneration = vi.fn();
    const plannerSnapshot = { places: [], itineraryItems: [], routeSegments: [] };
    const replaceAiGeneratedBatch = vi.fn().mockResolvedValue(plannerSnapshot);

    await withMockedAiPlanningService(
      {
        getTripById,
        requireTripRole,
        supabaseAiPlanningService: {
          listDestinationCandidates,
          getPrimaryLodging: vi.fn().mockResolvedValue(null),
          upsertPlanningPreferences,
          upsertPrimaryLodgingFromGoogleMapsUrl,
        },
        aiPlanner: { requestAiItineraryPlan },
        aiPlanApplication: {
          createAiPlanGeneration,
          updateAiPlanGeneration,
          replaceAiGeneratedBatch,
        },
      },
      async ({ service }) => {
        await expect(
          service.generateAiItineraryForRequest(1, "user-1", {
            visits_per_day_min: 1,
            visits_per_day_max: 3,
            interest_tags: ["landmarks"],
            preferred_travel_modes: ["walking"],
            must_see_candidate_ids: [10],
            daily_start_time: "08:30",
            lodging_google_maps_url: " https://maps.app.goo.gl/example ",
          }),
        ).resolves.toEqual({ generationId: 55, plannerSnapshot });
      },
      { openAiApiKey: "test-key", openAiModel: "gpt-5-mini-test" },
    );

    expect(upsertPrimaryLodgingFromGoogleMapsUrl).toHaveBeenCalledWith(
      1,
      "https://maps.app.goo.gl/example",
    );
    expect(requestAiItineraryPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          lodging: {
            name: "Pod Times Square",
            latitude: 40.758,
            longitude: -73.993,
          },
        }),
      }),
    );
    expect(replaceAiGeneratedBatch).toHaveBeenCalledWith(
      1,
      55,
      expect.any(Object),
      [candidateRecord(10)],
      savedPreferences,
      lodging,
      "08:30",
      "user-1",
      null,
      null,
    );
  });

  it("uses submitted arrival and departure stops as trip start and end anchors", async () => {
    const requireTripRole = vi.fn().mockResolvedValue(membership("owner"));
    const getTripById = vi.fn().mockResolvedValue(
      tripRecord({
        start_date: "2026-05-27",
        end_date: "2026-05-27",
      }),
    );
    const listDestinationCandidates = vi.fn().mockResolvedValue([
      candidateRecord(10),
    ]);
    const savedPreferences = savedPreferenceRecord({
      visits_per_day_min: 1,
      visits_per_day_max: 3,
      preferred_travel_modes: ["walking"],
      must_see_candidate_ids: [10],
    });
    const arrivalPoint = transitPointRecord("arrival", "15:00");
    const departurePoint = transitPointRecord("departure", "21:00");
    const upsertTransitPointFromGoogleMapsUrl = vi
      .fn()
      .mockImplementation((_tripId, kind) =>
        Promise.resolve(kind === "arrival" ? arrivalPoint : departurePoint),
      );
    const requestAiItineraryPlan = vi.fn().mockResolvedValue({
      plan: {
        days: [
          {
            date: "2026-05-27",
            visits: [
              {
                candidate_id: 10,
                start_time: "16:00",
                duration_minutes: 90,
                notes: null,
              },
            ],
          },
        ],
      },
      usage: { inputTokens: 10, outputTokens: 20 },
    });
    const createAiPlanGeneration = vi.fn().mockResolvedValue({ id: 55 });
    const plannerSnapshot = { places: [], itineraryItems: [], routeSegments: [] };
    const replaceAiGeneratedBatch = vi.fn().mockResolvedValue(plannerSnapshot);

    await withMockedAiPlanningService(
      {
        getTripById,
        requireTripRole,
        supabaseAiPlanningService: {
          listDestinationCandidates,
          getPrimaryLodging: vi.fn().mockResolvedValue(null),
          getTransitPoints: vi.fn().mockResolvedValue([]),
          upsertPlanningPreferences: vi.fn().mockResolvedValue(savedPreferences),
          upsertTransitPointFromGoogleMapsUrl,
        },
        aiPlanner: { requestAiItineraryPlan },
        aiPlanApplication: {
          createAiPlanGeneration,
          updateAiPlanGeneration: vi.fn(),
          replaceAiGeneratedBatch,
        },
      },
      async ({ service }) => {
        await expect(
          service.generateAiItineraryForRequest(1, "user-1", {
            visits_per_day_min: 1,
            visits_per_day_max: 3,
            interest_tags: ["landmarks"],
            preferred_travel_modes: ["walking"],
            must_see_candidate_ids: [10],
            daily_start_time: "08:30",
            arrival_google_maps_url: "https://maps.app.goo.gl/arrive",
            arrival_time: "15:00",
            departure_google_maps_url: "https://maps.app.goo.gl/depart",
            departure_time: "21:00",
          }),
        ).resolves.toEqual({ generationId: 55, plannerSnapshot });
      },
      { openAiApiKey: "test-key", openAiModel: "gpt-5-mini-test" },
    );

    expect(upsertTransitPointFromGoogleMapsUrl).toHaveBeenCalledWith(
      1,
      "arrival",
      "https://maps.app.goo.gl/arrive",
      "15:00",
    );
    expect(upsertTransitPointFromGoogleMapsUrl).toHaveBeenCalledWith(
      1,
      "departure",
      "https://maps.app.goo.gl/depart",
      "21:00",
    );
    expect(requestAiItineraryPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          trip_start_point: {
            name: "JFK Airport",
            latitude: 40.641,
            longitude: -73.778,
            time: "15:00",
          },
          trip_end_point: {
            name: "JFK Airport",
            latitude: 40.641,
            longitude: -73.778,
            time: "21:00",
          },
        }),
      }),
    );
    expect(replaceAiGeneratedBatch).toHaveBeenCalledWith(
      1,
      55,
      expect.any(Object),
      [candidateRecord(10)],
      savedPreferences,
      null,
      "08:30",
      "user-1",
      arrivalPoint,
      departurePoint,
    );
  });

  it("resolves a selected transit hub into the trip's arrival stop", async () => {
    const hub = transitHubRecord(71, "John F. Kennedy International Airport");
    const arrivalPoint = transitPointRecord("arrival", "15:00");
    const upsertTransitPointFromHub = vi.fn().mockResolvedValue(arrivalPoint);
    const upsertTransitPointFromGoogleMapsUrl = vi.fn();
    const requestAiItineraryPlan = vi.fn().mockResolvedValue({
      plan: {
        days: [
          {
            date: "2026-05-27",
            visits: [
              {
                candidate_id: 10,
                start_time: "16:00",
                duration_minutes: 90,
                notes: null,
              },
            ],
          },
        ],
      },
      usage: { inputTokens: 10, outputTokens: 20 },
    });
    const plannerSnapshot = { places: [], itineraryItems: [], routeSegments: [] };
    const replaceAiGeneratedBatch = vi.fn().mockResolvedValue(plannerSnapshot);

    await withMockedAiPlanningService(
      {
        getTripById: vi.fn().mockResolvedValue(
          tripRecord({ start_date: "2026-05-27", end_date: "2026-05-27" }),
        ),
        supabaseAiPlanningService: {
          listDestinationCandidates: vi
            .fn()
            .mockResolvedValue([candidateRecord(10)]),
          listDestinationTransitHubs: vi.fn().mockResolvedValue([hub]),
          upsertPlanningPreferences: vi.fn().mockResolvedValue(
            savedPreferenceRecord({ must_see_candidate_ids: [10] }),
          ),
          upsertTransitPointFromHub,
          upsertTransitPointFromGoogleMapsUrl,
        },
        aiPlanner: { requestAiItineraryPlan },
        aiPlanApplication: {
          createAiPlanGeneration: vi.fn().mockResolvedValue({ id: 55 }),
          updateAiPlanGeneration: vi.fn(),
          replaceAiGeneratedBatch,
        },
      },
      async ({ service }) => {
        await service.generateAiItineraryForRequest(1, "user-1", {
          visits_per_day_min: 1,
          visits_per_day_max: 3,
          preferred_travel_modes: ["walking"],
          must_see_candidate_ids: [10],
          arrival_hub_id: 71,
          arrival_time: "15:00",
        });
      },
      { openAiApiKey: "test-key", openAiModel: "gpt-5-mini-test" },
    );

    expect(upsertTransitPointFromHub).toHaveBeenCalledWith(
      1,
      "arrival",
      hub,
      "15:00",
    );
    expect(upsertTransitPointFromGoogleMapsUrl).not.toHaveBeenCalled();
    expect(requestAiItineraryPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          trip_start_point: {
            name: "JFK Airport",
            latitude: 40.641,
            longitude: -73.778,
            time: "15:00",
          },
        }),
      }),
    );
  });

  it("requires an explicit OpenAI planner model before requesting an itinerary", async () => {
    const requireTripRole = vi.fn().mockResolvedValue(membership("owner"));
    const getTripById = vi.fn().mockResolvedValue(tripRecord());
    const listDestinationCandidates = vi.fn().mockResolvedValue([
      candidateRecord(10),
    ]);
    const requestAiItineraryPlan = vi
      .fn()
      .mockResolvedValue(aiPlannerResult(10, 10, 20));
    const createAiPlanGeneration = vi.fn().mockResolvedValue({ id: 55 });
    const updateAiPlanGeneration = vi.fn();
    const replaceAiGeneratedBatch = vi.fn().mockResolvedValue({
      places: [],
      itineraryItems: [],
      routeSegments: [],
    });

    await withMockedAiPlanningService(
      {
        getTripById,
        requireTripRole,
        supabaseAiPlanningService: {
          listDestinationCandidates,
          getPrimaryLodging: vi.fn().mockResolvedValue(null),
          upsertPlanningPreferences: vi.fn().mockResolvedValue(
            savedPreferenceRecord(),
          ),
        },
        aiPlanner: { requestAiItineraryPlan },
        aiPlanApplication: {
          createAiPlanGeneration,
          updateAiPlanGeneration,
          replaceAiGeneratedBatch,
        },
      },
      async ({ service }) => {
        await expect(
          service.generateAiItineraryForRequest(1, "user-1", {
            visits_per_day_min: 1,
            visits_per_day_max: 3,
            interest_tags: ["landmarks"],
            preferred_travel_modes: ["walking"],
            must_see_candidate_ids: [],
          }),
        ).rejects.toThrow("OpenAI AI planner model is not configured.");
      },
      { openAiApiKey: "test-key" },
    );

    expect(requestAiItineraryPlan).not.toHaveBeenCalled();
    expect(updateAiPlanGeneration).toHaveBeenCalledWith(
      55,
      expect.objectContaining({
        status: "failed",
        failure_reason: "OpenAI AI planner model is not configured.",
      }),
    );
  });
});
