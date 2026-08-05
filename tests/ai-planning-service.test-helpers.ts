import { vi } from "vitest";

import type {
  AiDestinationCandidate,
  AiTransitHubType,
  Trip,
  TripMembership,
  TripTransitPoint,
  TripTransitPointKind,
} from "@/lib/types";

export async function withMockedAiPlanningService(
  mocks: {
    getTripById?: ReturnType<typeof vi.fn>;
    requireTripRole?: ReturnType<typeof vi.fn>;
    supabaseAiPlanningService?: Record<string, ReturnType<typeof vi.fn>>;
    aiPlanner?: Record<string, ReturnType<typeof vi.fn>>;
    aiCatalog?: Record<string, ReturnType<typeof vi.fn>>;
    candidateImages?: Record<string, ReturnType<typeof vi.fn>>;
    aiPlanApplication?: Record<string, ReturnType<typeof vi.fn>>;
  },
  run: (context: {
    service: typeof import("@/server/ai-planning-service");
  }) => Promise<void> | void,
  options: { openAiApiKey?: string; openAiModel?: string } = {},
): Promise<void> {
  vi.resetModules();
  const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
  const originalOpenAiModel = process.env.OPENAI_AI_PLANNER_MODEL;
  if (options.openAiApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = options.openAiApiKey;
  }
  if (options.openAiModel === undefined) {
    delete process.env.OPENAI_AI_PLANNER_MODEL;
  } else {
    process.env.OPENAI_AI_PLANNER_MODEL = options.openAiModel;
  }

  vi.doMock("@/server/supabase-ai-planning-service", () => ({
    listDestinationCandidates: vi.fn().mockResolvedValue([]),
    listDestinationTransitHubs: vi.fn().mockResolvedValue([]),
    getPrimaryLodging: vi.fn().mockResolvedValue(null),
    getTransitPoints: vi.fn().mockResolvedValue([]),
    getPlanningPreferences: vi.fn().mockResolvedValue(null),
    upsertPlanningPreferences: vi.fn(),
    upsertPrimaryLodgingFromGoogleMapsUrl: vi.fn(),
    upsertTransitPointFromGoogleMapsUrl: vi.fn(),
    upsertTransitPointFromHub: vi.fn(),
    updateTransitPointTime: vi.fn(),
    insertDestinationCandidates: vi.fn(),
    insertDestinationTransitHubs: vi.fn(),
    ...mocks.supabaseAiPlanningService,
  }));
  // Only the OpenAI request is stubbed; the module's planning constants stay
  // real so production code that reads them keeps its true values.
  vi.doMock("@/server/openai-ai-planner", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/server/openai-ai-planner")>()),
    requestAiItineraryPlan: vi.fn(),
    ...mocks.aiPlanner,
  }));
  // Keep the real sanitizer so catalog tests exercise production filtering;
  // only the OpenAI request is stubbed.
  vi.doMock("@/server/openai-destination-catalog", async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/server/openai-destination-catalog")
    >()),
    requestAiDestinationCatalog: vi.fn(),
    requestAiDestinationTransitHubs: vi.fn(),
    ...mocks.aiCatalog,
  }));
  vi.doMock("@/server/google-candidate-images", () => ({
    resolveCandidateImagesWithGoogle: vi.fn().mockResolvedValue(undefined),
    ...mocks.candidateImages,
  }));
  vi.doMock("@/server/supabase-ai-plan-application-service", () => ({
    countUserGenerationsToday: vi.fn().mockResolvedValue(0),
    createAiPlanGeneration: vi.fn(),
    updateAiPlanGeneration: vi.fn(),
    replaceAiGeneratedBatch: vi.fn(),
    ...mocks.aiPlanApplication,
  }));
  // Guest generations are quota-checked against the guest usage store; keep the
  // real kind constants so the production call sites stay honest.
  vi.doMock("@/server/guest-usage-store", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/server/guest-usage-store")>()),
    countGuestCallsToday: vi.fn().mockResolvedValue(0),
    countAllGuestCallsToday: vi.fn().mockResolvedValue(0),
    recordGuestCall: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock("@/server/supabase-google-routes-usage-store", () => ({
    GOOGLE_ROUTES_DAILY_LIMIT: 200,
    assertGoogleRoutesQuota: vi.fn().mockResolvedValue(undefined),
    countUserGoogleRoutesCallsToday: vi.fn().mockResolvedValue(0),
    recordGoogleRoutesCall: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock("@/server/trip-access", () => ({
    requireTripRole:
      mocks.requireTripRole ?? vi.fn().mockResolvedValue(membership()),
  }));
  vi.doMock("@/server/trip-service", () => ({
    getTripById: mocks.getTripById ?? vi.fn().mockResolvedValue(tripRecord()),
  }));

  try {
    const service = await import("@/server/ai-planning-service");
    await run({ service });
  } finally {
    vi.doUnmock("@/server/supabase-ai-planning-service");
    vi.doUnmock("@/server/openai-ai-planner");
    vi.doUnmock("@/server/openai-destination-catalog");
    vi.doUnmock("@/server/google-candidate-images");
    vi.doUnmock("@/server/supabase-ai-plan-application-service");
    vi.doUnmock("@/server/guest-usage-store");
    vi.doUnmock("@/server/supabase-google-routes-usage-store");
    vi.doUnmock("@/server/trip-access");
    vi.doUnmock("@/server/trip-service");
    if (originalOpenAiApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiApiKey;
    }
    if (originalOpenAiModel === undefined) {
      delete process.env.OPENAI_AI_PLANNER_MODEL;
    } else {
      process.env.OPENAI_AI_PLANNER_MODEL = originalOpenAiModel;
    }
    vi.restoreAllMocks();
    vi.resetModules();
  }
}

export function aiPlannerResult(
  candidateId: number,
  inputTokens: number,
  outputTokens: number,
) {
  return {
    plan: {
      days: [
        {
          date: "2026-05-27",
          visits: [
            {
              candidate_id: candidateId,
              start_time: "09:00",
              duration_minutes: 90,
              notes: null,
            },
          ],
        },
      ],
    },
    usage: { inputTokens, outputTokens },
    webSearchCalls: [],
  };
}

export function savedPreferenceRecord(
  overrides: Partial<{
    visits_per_day_min: number;
    visits_per_day_max: number;
    interest_tags: string[];
    avoid_interest_tags: string[];
    preferred_travel_modes: string[];
    must_see_candidate_ids: number[];
    daily_start_time: string;
    include_lunch_stop: boolean;
    dining_budget: string | null;
    dietary_tags: string[];
    dietary_notes: string | null;
  }> = {},
) {
  return {
    trip_id: 1,
    visits_per_day_min: 1,
    visits_per_day_max: 3,
    interest_tags: ["landmarks"],
    avoid_interest_tags: [],
    preferred_travel_modes: ["walking"],
    must_see_candidate_ids: [],
    daily_start_time: "09:00",
    include_lunch_stop: false,
    dining_budget: null,
    dietary_tags: [],
    dietary_notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function membership(
  role: TripMembership["role"] = "owner",
): TripMembership {
  return {
    trip_id: 1,
    user_id: "user-1",
    role,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

export function tripRecord(overrides: Partial<Trip> = {}): Trip {
  return {
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
    ...overrides,
  };
}

export function transitHubRecord(id: number, name: string) {
  return {
    id,
    destination_slug: "new-york-city",
    name,
    hub_type: "airport" as const,
    iata_code: "JFK",
    latitude: 40.641,
    longitude: -73.778,
    sort_order: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

export function transitPointRecord(
  kind: TripTransitPointKind,
  eventTime: string | null,
  hubType: AiTransitHubType | null = "airport",
): TripTransitPoint {
  return {
    id: kind === "arrival" ? 8 : 9,
    trip_id: 1,
    kind,
    name: "JFK Airport",
    latitude: 40.641,
    longitude: -73.778,
    google_place_id: null,
    hub_type: hubType,
    event_time: eventTime,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

export function candidateRecord(id: number): AiDestinationCandidate {
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
