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

describe("listDestinationCandidatesForRequest", () => {
  it("requires owner access and returns the destination's candidate catalog", async () => {
    const candidates = [candidateRecord(1), candidateRecord(2)];
    const requireTripRole = vi.fn().mockResolvedValue(membership("owner"));
    const listDestinationCandidates = vi.fn().mockResolvedValue(candidates);

    await withMockedAiPlanningService(
      {
        requireTripRole,
        getTripById: vi
          .fn()
          .mockResolvedValue(tripRecord({ destination_slug: "new-york-city" })),
        supabaseAiPlanningService: { listDestinationCandidates },
      },
      async ({ service }) => {
        await expect(
          service.listDestinationCandidatesForRequest(1, "user-1"),
        ).resolves.toEqual(candidates);
      },
    );

    expect(requireTripRole).toHaveBeenCalledWith(1, "user-1", "owner");
    expect(listDestinationCandidates).toHaveBeenCalledWith("new-york-city");
  });

  it("lists custom Google-searched destinations under their derived catalog key", async () => {
    const listDestinationCandidates = vi.fn().mockResolvedValue([]);

    await withMockedAiPlanningService(
      {
        getTripById: vi.fn().mockResolvedValue(
          tripRecord({
            destination: "Lisbon",
            destination_slug: null,
            destination_latitude: 38.7223,
            destination_longitude: -9.1393,
            destination_country_codes: ["PT"],
          }),
        ),
        supabaseAiPlanningService: { listDestinationCandidates },
      },
      async ({ service }) => {
        await expect(
          service.listDestinationCandidatesForRequest(1, "user-1"),
        ).resolves.toEqual([]);
      },
    );

    expect(listDestinationCandidates).toHaveBeenCalledWith(
      "custom-lisbon-38.7,-9.1",
    );
  });

  it("returns an empty list without querying the catalog when the destination has no catalog key", async () => {
    const listDestinationCandidates = vi.fn();

    await withMockedAiPlanningService(
      {
        getTripById: vi.fn().mockResolvedValue(
          tripRecord({
            destination: "",
            destination_slug: null,
          }),
        ),
        supabaseAiPlanningService: { listDestinationCandidates },
      },
      async ({ service }) => {
        await expect(
          service.listDestinationCandidatesForRequest(1, "user-1"),
        ).resolves.toEqual([]);
      },
    );

    expect(listDestinationCandidates).not.toHaveBeenCalled();
  });
});

describe("ai-planning-service request boundary", () => {
  it("requires owner access and reports an unprepared catalog as not ready", async () => {
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
          candidatesReady: false,
          candidates: [],
          lodging: null,
          arrivalPoint: null,
          departurePoint: null,
          transitHubs: [],
          preferences: null,
          profileDietaryDefaults: null,
        });
      },
    );

    expect(requireTripRole).toHaveBeenCalledWith(1, "user-1", "owner");
    expect(getTripById).toHaveBeenCalledWith(1);
    expect(listDestinationCandidates).toHaveBeenCalledWith("new-york-city");
    expect(getPrimaryLodging).toHaveBeenCalledWith(1);
    expect(getPlanningPreferences).toHaveBeenCalledWith(1);
  });

  it("returns not-ready setup without reading AI planning tables when the destination has no catalog key", async () => {
    const trip = tripRecord({ destination: "", destination_slug: null });
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
          candidatesReady: false,
          candidates: [],
          lodging: null,
          arrivalPoint: null,
          departurePoint: null,
          transitHubs: [],
          preferences: null,
          profileDietaryDefaults: null,
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
      daily_start_time: "09:00",
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
      avoid_interest_tags: [],
      preferred_travel_modes: ["walking", "transit"],
      must_see_candidate_ids: [10],
      daily_start_time: "09:00",
      include_lunch_stop: false,
      dining_budget: null,
      dietary_tags: [],
      dietary_notes: null,
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
      daily_start_time: "08:30",
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
    // Only the primary call spends web searches; the repair runs without.
    expect(requestAiItineraryPlan.mock.calls[0][0].enableWebSearch).toBe(true);
    expect(
      requestAiItineraryPlan.mock.calls[1][0].enableWebSearch,
    ).toBeUndefined();
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
      new Map(),
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

  it("drops avoided-tag candidates from the planner catalog but keeps avoided must-sees", async () => {
    const requireTripRole = vi.fn().mockResolvedValue(membership("owner"));
    const getTripById = vi.fn().mockResolvedValue(
      tripRecord({ start_date: "2026-05-27", end_date: "2026-05-27" }),
    );
    const mustSeeMuseum = { ...candidateRecord(12), tags: ["museums"] };
    const listDestinationCandidates = vi.fn().mockResolvedValue([
      candidateRecord(10),
      { ...candidateRecord(11), tags: ["museums"] },
      mustSeeMuseum,
    ]);
    const savedPreferences = savedPreferenceRecord({
      interest_tags: [],
      avoid_interest_tags: ["museums"],
      must_see_candidate_ids: [12],
    });
    const upsertPlanningPreferences = vi
      .fn()
      .mockResolvedValue(savedPreferences);
    const requestAiItineraryPlan = vi
      .fn()
      .mockResolvedValue(aiPlannerResult(12, 10, 20));
    const createAiPlanGeneration = vi.fn().mockResolvedValue({ id: 57 });
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
            avoid_interest_tags: ["museums"],
            preferred_travel_modes: ["walking"],
            must_see_candidate_ids: [12],
          }),
        ).resolves.toEqual({ generationId: 57, plannerSnapshot });
      },
      { openAiApiKey: "test-key", openAiModel: "gpt-5-mini-test" },
    );

    // The avoided museum (11) never reaches the model; the must-see museum
    // (12) stays because an explicit place pick overrides the tag rule.
    expect(
      requestAiItineraryPlan.mock.calls[0][0].context.candidates.map(
        (candidate: { id: number }) => candidate.id,
      ),
    ).toEqual([10, 12]);
    expect(replaceAiGeneratedBatch).toHaveBeenCalledWith(
      1,
      57,
      expect.any(Object),
      [candidateRecord(10), mustSeeMuseum],
      savedPreferences,
      null,
      "09:00",
      "user-1",
      null,
      null,
      new Map(),
    );
  });

  it("rejects generation when avoided interests rule out the whole catalog", async () => {
    const listDestinationCandidates = vi
      .fn()
      .mockResolvedValue([candidateRecord(10)]);
    const upsertPlanningPreferences = vi.fn().mockResolvedValue(
      savedPreferenceRecord({
        interest_tags: [],
        avoid_interest_tags: ["landmarks"],
      }),
    );
    const requestAiItineraryPlan = vi.fn();
    const createAiPlanGeneration = vi.fn();

    await withMockedAiPlanningService(
      {
        supabaseAiPlanningService: {
          listDestinationCandidates,
          getPrimaryLodging: vi.fn().mockResolvedValue(null),
          upsertPlanningPreferences,
        },
        aiPlanner: { requestAiItineraryPlan },
        aiPlanApplication: { createAiPlanGeneration },
      },
      async ({ service }) => {
        await expect(
          service.generateAiItineraryForRequest(1, "user-1", {
            avoid_interest_tags: ["landmarks"],
            preferred_travel_modes: ["walking"],
          }),
        ).rejects.toThrow(
          "Your avoided interests rule out every attraction",
        );
      },
      { openAiApiKey: "test-key", openAiModel: "gpt-5-mini-test" },
    );

    expect(requestAiItineraryPlan).not.toHaveBeenCalled();
    expect(createAiPlanGeneration).not.toHaveBeenCalled();
  });

  it("rejects AI generation for trips longer than the planning cap before any spend", async () => {
    const requireTripRole = vi.fn().mockResolvedValue(membership("owner"));
    // 2026-01-01 to 2026-06-30 inclusive is 181 days, one past the cap.
    const getTripById = vi.fn().mockResolvedValue(
      tripRecord({ start_date: "2026-01-01", end_date: "2026-06-30" }),
    );
    const requestAiItineraryPlan = vi.fn();
    const createAiPlanGeneration = vi.fn();

    await withMockedAiPlanningService(
      {
        getTripById,
        requireTripRole,
        aiPlanner: { requestAiItineraryPlan },
        aiPlanApplication: { createAiPlanGeneration },
      },
      async ({ service }) => {
        await expect(
          service.generateAiItineraryForRequest(1, "user-1", {}),
        ).rejects.toThrow("AI planning supports trips up to 180 days");
      },
      { openAiApiKey: "test-key", openAiModel: "gpt-5-mini-test" },
    );

    expect(requestAiItineraryPlan).not.toHaveBeenCalled();
    expect(createAiPlanGeneration).not.toHaveBeenCalled();
  });

  it("plans coverage trips with free days when the catalog cannot fill every day", async () => {
    const requireTripRole = vi.fn().mockResolvedValue(membership("owner"));
    // 5 days at minimum pace 1 exceed the 2-candidate catalog, so the plan may
    // leave free days once it schedules the coverage floor.
    const getTripById = vi.fn().mockResolvedValue(
      tripRecord({ start_date: "2026-05-27", end_date: "2026-05-31" }),
    );
    const listDestinationCandidates = vi
      .fn()
      .mockResolvedValue([candidateRecord(10), candidateRecord(11)]);
    const upsertPlanningPreferences = vi.fn().mockResolvedValue(
      savedPreferenceRecord({
        visits_per_day_min: 1,
        visits_per_day_max: 3,
        must_see_candidate_ids: [],
      }),
    );
    const requestAiItineraryPlan = vi
      .fn()
      .mockResolvedValue(aiPlannerResult(10, 10, 20));
    const createAiPlanGeneration = vi.fn().mockResolvedValue({ id: 56 });
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
          }),
        ).resolves.toEqual({ generationId: 56, plannerSnapshot });
      },
      { openAiApiKey: "test-key", openAiModel: "gpt-5-mini-test" },
    );

    // A single-day plan over a five-day trip is valid in coverage mode, so no
    // repair call happens and the prompt context carries the coverage floor.
    expect(requestAiItineraryPlan).toHaveBeenCalledTimes(1);
    expect(requestAiItineraryPlan.mock.calls[0][0].context.coverage).toEqual({
      min_total_visits: 1,
    });
    expect(updateAiPlanGeneration).toHaveBeenLastCalledWith(
      56,
      expect.objectContaining({
        status: "completed",
        primary_validation_status: "valid",
        repair_attempted: false,
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
      daily_start_time: "08:30",
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
      new Map(),
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
      daily_start_time: "08:30",
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
            type: "airport",
            time: "15:00",
          },
          trip_end_point: {
            name: "JFK Airport",
            latitude: 40.641,
            longitude: -73.778,
            type: "airport",
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
      new Map(),
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
            type: "airport",
            time: "15:00",
          },
        }),
      }),
    );
  });

  it("rejects and repairs a first-day visit inside the airport arrival buffer", async () => {
    const hub = transitHubRecord(71, "John F. Kennedy International Airport");
    const arrivalPoint = transitPointRecord("arrival", "15:00", "airport");
    const rushedFirstVisit = {
      plan: {
        days: [
          {
            date: "2026-05-27",
            visits: [
              {
                candidate_id: 10,
                // Landing time itself — before the 60-minute airport egress buffer.
                start_time: "15:00",
                duration_minutes: 90,
                notes: null,
              },
            ],
          },
        ],
      },
      usage: { inputTokens: 10, outputTokens: 20 },
    };
    const repairedFirstVisit = {
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
      usage: { inputTokens: 5, outputTokens: 10 },
    };
    const requestAiItineraryPlan = vi
      .fn()
      .mockResolvedValueOnce(rushedFirstVisit)
      .mockResolvedValueOnce(repairedFirstVisit);
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
          upsertTransitPointFromHub: vi.fn().mockResolvedValue(arrivalPoint),
        },
        aiPlanner: { requestAiItineraryPlan },
        aiPlanApplication: {
          createAiPlanGeneration: vi.fn().mockResolvedValue({ id: 55 }),
          updateAiPlanGeneration: vi.fn(),
          replaceAiGeneratedBatch,
        },
      },
      async ({ service }) => {
        await expect(
          service.generateAiItineraryForRequest(1, "user-1", {
            visits_per_day_min: 1,
            visits_per_day_max: 3,
            preferred_travel_modes: ["walking"],
            must_see_candidate_ids: [10],
            arrival_hub_id: 71,
            arrival_time: "15:00",
          }),
        ).resolves.toEqual({ generationId: 55, plannerSnapshot });
      },
      { openAiApiKey: "test-key", openAiModel: "gpt-5-mini-test" },
    );

    expect(requestAiItineraryPlan).toHaveBeenCalledTimes(2);
    expect(requestAiItineraryPlan.mock.calls[1][0].context.validationErrors).toContain(
      "Day 2026-05-27 has a visit before 16:00.",
    );
    expect(replaceAiGeneratedBatch).toHaveBeenCalledWith(
      1,
      55,
      repairedFirstVisit.plan,
      [candidateRecord(10)],
      expect.any(Object),
      null,
      expect.any(String),
      "user-1",
      arrivalPoint,
      null,
      new Map(),
    );
  });

  it("fails the generation when the repaired plan still starts inside the airport arrival buffer", async () => {
    const hub = transitHubRecord(71, "John F. Kennedy International Airport");
    const arrivalPoint = transitPointRecord("arrival", "15:00", "airport");
    const planWithVisitAt = (startTime: string) => ({
      plan: {
        days: [
          {
            date: "2026-05-27",
            visits: [
              {
                candidate_id: 10,
                start_time: startTime,
                duration_minutes: 90,
                notes: null,
              },
            ],
          },
        ],
      },
      usage: { inputTokens: 10, outputTokens: 20 },
    });
    const requestAiItineraryPlan = vi
      .fn()
      // Landing time itself, then a repair that is after the raw landing time
      // but still inside the 60-minute airport egress buffer.
      .mockResolvedValueOnce(planWithVisitAt("15:00"))
      .mockResolvedValueOnce(planWithVisitAt("15:30"));
    const updateAiPlanGeneration = vi.fn();
    const replaceAiGeneratedBatch = vi.fn();

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
          upsertTransitPointFromHub: vi.fn().mockResolvedValue(arrivalPoint),
        },
        aiPlanner: { requestAiItineraryPlan },
        aiPlanApplication: {
          createAiPlanGeneration: vi.fn().mockResolvedValue({ id: 55 }),
          updateAiPlanGeneration,
          replaceAiGeneratedBatch,
        },
      },
      async ({ service }) => {
        await expect(
          service.generateAiItineraryForRequest(1, "user-1", {
            visits_per_day_min: 1,
            visits_per_day_max: 3,
            preferred_travel_modes: ["walking"],
            must_see_candidate_ids: [10],
            arrival_hub_id: 71,
            arrival_time: "15:00",
          }),
        ).rejects.toThrow(
          "The AI planner couldn't create an itinerary with your current preferences.",
        );
      },
      { openAiApiKey: "test-key", openAiModel: "gpt-5-mini-test" },
    );

    expect(replaceAiGeneratedBatch).not.toHaveBeenCalled();
    expect(updateAiPlanGeneration).toHaveBeenLastCalledWith(
      55,
      expect.objectContaining({
        status: "failed",
        repair_attempted: true,
        repair_validation_status: "invalid",
        repair_validation_errors: expect.arrayContaining([
          "Day 2026-05-27 has a visit before 16:00.",
        ]),
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

describe("prepareDestinationCatalogForRequest", () => {
  function generatedCatalog(count: number) {
    return {
      candidates: Array.from({ length: count }, (_, index) => ({
        name: `Generated Spot ${index + 1}`,
        category: "landmark",
        tags: ["landmarks"],
        area: "Alfama",
        region_distance_tier: "central" as const,
        latitude: 38.71 + index * 0.001,
        longitude: -9.13,
        typical_duration_minutes: 60,
        indoor_outdoor: null,
        planning_note: null,
        blurb: null,
      })),
    };
  }

  const customTrip = () =>
    tripRecord({
      destination: "Lisbon",
      destination_slug: null,
      destination_latitude: 38.7223,
      destination_longitude: -9.1393,
      destination_country_codes: ["PT"],
    });

  it("generates, persists, and logs a catalog for a destination without one", async () => {
    const generated = generatedCatalog(15);
    const insertedCandidates = [candidateRecord(1)];
    const listDestinationCandidates = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue(insertedCandidates);
    const insertDestinationCandidates = vi
      .fn()
      .mockResolvedValue(insertedCandidates);
    const requestAiDestinationCatalog = vi.fn().mockResolvedValue({
      catalog: generated,
      usage: { inputTokens: 100, outputTokens: 200 },
    });
    const resolveCandidateImagesWithGoogle = vi
      .fn()
      .mockResolvedValue(undefined);
    const createAiPlanGeneration = vi.fn().mockResolvedValue({ id: 77 });
    const updateAiPlanGeneration = vi.fn();

    await withMockedAiPlanningService(
      {
        getTripById: vi.fn().mockResolvedValue(customTrip()),
        supabaseAiPlanningService: {
          listDestinationCandidates,
          insertDestinationCandidates,
        },
        aiCatalog: { requestAiDestinationCatalog },
        candidateImages: { resolveCandidateImagesWithGoogle },
        aiPlanApplication: { createAiPlanGeneration, updateAiPlanGeneration },
      },
      async ({ service }) => {
        const setup = await service.prepareDestinationCatalogForRequest(
          1,
          "user-1",
        );
        expect(setup.candidatesReady).toBe(true);
        expect(setup.candidates).toEqual(insertedCandidates);
      },
      { openAiApiKey: "test-key", openAiModel: "gpt-5-mini-test" },
    );

    expect(requestAiDestinationCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5-mini-test",
        destination: expect.objectContaining({
          name: "Lisbon",
          latitude: 38.7223,
          longitude: -9.1393,
          countryNames: ["Portugal"],
        }),
      }),
    );
    expect(insertDestinationCandidates).toHaveBeenCalledWith(
      "custom-lisbon-38.7,-9.1",
      expect.arrayContaining([
        expect.objectContaining({ name: "Generated Spot 1", sort_order: 1 }),
      ]),
    );
    expect(resolveCandidateImagesWithGoogle).toHaveBeenCalledWith({
      candidates: insertedCandidates,
      destination: expect.objectContaining({ name: "Lisbon" }),
      userId: "user-1",
    });
    expect(createAiPlanGeneration).toHaveBeenCalledWith(1, "user-1", {
      prompt_version: "ai-destination-catalog-v3",
      preferences_snapshot: {},
      candidate_count: 0,
      must_see_count: 0,
    });
    expect(updateAiPlanGeneration).toHaveBeenCalledWith(
      77,
      expect.objectContaining({
        status: "completed",
        generated_place_count: 1,
        token_input_count: 100,
        token_output_count: 200,
      }),
    );
  });

  it("returns the existing setup without generating when the catalog already exists", async () => {
    const listDestinationCandidates = vi
      .fn()
      .mockResolvedValue([candidateRecord(1)]);
    const requestAiDestinationCatalog = vi.fn();
    const createAiPlanGeneration = vi.fn();

    await withMockedAiPlanningService(
      {
        getTripById: vi.fn().mockResolvedValue(customTrip()),
        supabaseAiPlanningService: { listDestinationCandidates },
        aiCatalog: { requestAiDestinationCatalog },
        aiPlanApplication: { createAiPlanGeneration },
      },
      async ({ service }) => {
        const setup = await service.prepareDestinationCatalogForRequest(
          1,
          "user-1",
        );
        expect(setup.candidatesReady).toBe(true);
      },
      { openAiApiKey: "test-key", openAiModel: "gpt-5-mini-test" },
    );

    expect(requestAiDestinationCatalog).not.toHaveBeenCalled();
    expect(createAiPlanGeneration).not.toHaveBeenCalled();
  });

  it("rejects trips whose destination has no catalog key", async () => {
    await withMockedAiPlanningService(
      {
        getTripById: vi
          .fn()
          .mockResolvedValue(tripRecord({ destination: "", destination_slug: null })),
      },
      async ({ service }) => {
        await expect(
          service.prepareDestinationCatalogForRequest(1, "user-1"),
        ).rejects.toThrow("AI planning needs a trip destination first.");
      },
    );
  });

  it("marks the logged generation failed when catalog generation fails", async () => {
    const listDestinationCandidates = vi.fn().mockResolvedValue([]);
    const requestAiDestinationCatalog = vi
      .fn()
      .mockRejectedValue(new Error("OpenAI destination catalog generation failed: boom"));
    const createAiPlanGeneration = vi.fn().mockResolvedValue({ id: 77 });
    const updateAiPlanGeneration = vi.fn();

    await withMockedAiPlanningService(
      {
        getTripById: vi.fn().mockResolvedValue(customTrip()),
        supabaseAiPlanningService: { listDestinationCandidates },
        aiCatalog: { requestAiDestinationCatalog },
        aiPlanApplication: { createAiPlanGeneration, updateAiPlanGeneration },
      },
      async ({ service }) => {
        await expect(
          service.prepareDestinationCatalogForRequest(1, "user-1"),
        ).rejects.toThrow("OpenAI destination catalog generation failed: boom");
      },
      { openAiApiKey: "test-key", openAiModel: "gpt-5-mini-test" },
    );

    expect(updateAiPlanGeneration).toHaveBeenCalledWith(
      77,
      expect.objectContaining({
        status: "failed",
        failure_reason: "OpenAI destination catalog generation failed: boom",
      }),
    );
  });
});

describe("prepareDestinationTransitHubsForRequest", () => {
  const customTrip = () =>
    tripRecord({
      destination: "Lisbon",
      destination_slug: null,
      destination_latitude: 38.7223,
      destination_longitude: -9.1393,
      destination_country_codes: ["PT"],
    });

  it("generates, persists, and logs hubs for a destination without any", async () => {
    const insertedHubs = [transitHubRecord(5, "Lisbon Airport")];
    const listDestinationTransitHubs = vi.fn().mockResolvedValue([]);
    const insertDestinationTransitHubs = vi
      .fn()
      .mockResolvedValue(insertedHubs);
    const requestAiDestinationTransitHubs = vi.fn().mockResolvedValue({
      hubList: {
        transit_hubs: [
          {
            name: "Lisbon Airport",
            hub_type: "airport",
            iata_code: "LIS",
            latitude: 38.7742,
            longitude: -9.1342,
          },
        ],
      },
      usage: { inputTokens: 10, outputTokens: 20 },
    });
    const createAiPlanGeneration = vi.fn().mockResolvedValue({ id: 78 });
    const updateAiPlanGeneration = vi.fn();

    await withMockedAiPlanningService(
      {
        getTripById: vi.fn().mockResolvedValue(customTrip()),
        supabaseAiPlanningService: {
          listDestinationTransitHubs,
          insertDestinationTransitHubs,
        },
        aiCatalog: { requestAiDestinationTransitHubs },
        aiPlanApplication: { createAiPlanGeneration, updateAiPlanGeneration },
      },
      async ({ service }) => {
        await expect(
          service.prepareDestinationTransitHubsForRequest(1, "user-1"),
        ).resolves.toEqual(insertedHubs);
      },
      { openAiApiKey: "test-key", openAiModel: "gpt-5-mini-test" },
    );

    expect(insertDestinationTransitHubs).toHaveBeenCalledWith(
      "custom-lisbon-38.7,-9.1",
      [expect.objectContaining({ name: "Lisbon Airport", sort_order: 1 })],
    );
    expect(createAiPlanGeneration).toHaveBeenCalledWith(1, "user-1", {
      prompt_version: "ai-destination-transit-hubs-v1",
      preferences_snapshot: {},
      candidate_count: 0,
      must_see_count: 0,
    });
    expect(updateAiPlanGeneration).toHaveBeenCalledWith(
      78,
      expect.objectContaining({ status: "completed", generated_place_count: 1 }),
    );
  });

  it("returns existing hubs without generating", async () => {
    const existing = [transitHubRecord(5, "Lisbon Airport")];
    const requestAiDestinationTransitHubs = vi.fn();
    const createAiPlanGeneration = vi.fn();

    await withMockedAiPlanningService(
      {
        getTripById: vi.fn().mockResolvedValue(customTrip()),
        supabaseAiPlanningService: {
          listDestinationTransitHubs: vi.fn().mockResolvedValue(existing),
        },
        aiCatalog: { requestAiDestinationTransitHubs },
        aiPlanApplication: { createAiPlanGeneration },
      },
      async ({ service }) => {
        await expect(
          service.prepareDestinationTransitHubsForRequest(1, "user-1"),
        ).resolves.toEqual(existing);
      },
      { openAiApiKey: "test-key", openAiModel: "gpt-5-mini-test" },
    );

    expect(requestAiDestinationTransitHubs).not.toHaveBeenCalled();
    expect(createAiPlanGeneration).not.toHaveBeenCalled();
  });
});

describe("generateAiItineraryForRequest catalog gate", () => {
  it("rejects generation when the destination catalog is not prepared yet", async () => {
    const requestAiItineraryPlan = vi.fn();

    await withMockedAiPlanningService(
      {
        getTripById: vi.fn().mockResolvedValue(
          tripRecord({ start_date: "2026-05-27", end_date: "2026-05-27" }),
        ),
        supabaseAiPlanningService: {
          listDestinationCandidates: vi.fn().mockResolvedValue([]),
        },
        aiPlanner: { requestAiItineraryPlan },
      },
      async ({ service }) => {
        await expect(
          service.generateAiItineraryForRequest(1, "user-1", {
            visits_per_day_min: 1,
            visits_per_day_max: 3,
            interest_tags: [],
            preferred_travel_modes: ["walking"],
            must_see_candidate_ids: [],
          }),
        ).rejects.toThrow(
          "This destination's attraction catalog hasn't been prepared yet.",
        );
      },
      { openAiApiKey: "test-key", openAiModel: "gpt-5-mini-test" },
    );

    expect(requestAiItineraryPlan).not.toHaveBeenCalled();
  });
});
