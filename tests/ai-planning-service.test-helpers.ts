import { vi } from "vitest";

import type { Trip, TripMembership } from "@/lib/types";

export async function withMockedAiPlanningService(
  mocks: {
    getTripById?: ReturnType<typeof vi.fn>;
    requireTripRole?: ReturnType<typeof vi.fn>;
    supabaseAiPlanningService?: Record<string, ReturnType<typeof vi.fn>>;
    aiPlanner?: Record<string, ReturnType<typeof vi.fn>>;
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
    getPrimaryLodging: vi.fn().mockResolvedValue(null),
    getPlanningPreferences: vi.fn().mockResolvedValue(null),
    upsertPlanningPreferences: vi.fn(),
    upsertPrimaryLodgingFromGoogleMapsUrl: vi.fn(),
    ...mocks.supabaseAiPlanningService,
  }));
  vi.doMock("@/server/openai-ai-planner", () => ({
    requestAiItineraryPlan: vi.fn(),
    ...mocks.aiPlanner,
  }));
  vi.doMock("@/server/supabase-ai-plan-application-service", () => ({
    createAiPlanGeneration: vi.fn(),
    updateAiPlanGeneration: vi.fn(),
    replaceAiGeneratedBatch: vi.fn(),
    ...mocks.aiPlanApplication,
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
    vi.doUnmock("@/server/supabase-ai-plan-application-service");
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
  };
}

export function savedPreferenceRecord(
  overrides: Partial<{
    visits_per_day_min: number;
    visits_per_day_max: number;
    interest_tags: string[];
    preferred_travel_modes: string[];
    must_see_candidate_ids: number[];
  }> = {},
) {
  return {
    trip_id: 1,
    visits_per_day_min: 1,
    visits_per_day_max: 3,
    interest_tags: ["landmarks"],
    preferred_travel_modes: ["walking"],
    must_see_candidate_ids: [],
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
    start_date: "2026-05-27",
    end_date: "2026-05-29",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function candidateRecord(id: number) {
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
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}
