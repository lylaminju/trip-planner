import { describe, expect, it, vi } from "vitest";

import type { Trip, TripMembership } from "@/lib/types";

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
    const trip = tripRecord({ destination_slug: "toronto" });
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
});

async function withMockedAiPlanningService(
  mocks: {
    getTripById?: ReturnType<typeof vi.fn>;
    requireTripRole?: ReturnType<typeof vi.fn>;
    supabaseAiPlanningService?: Record<string, ReturnType<typeof vi.fn>>;
  },
  run: (context: {
    service: typeof import("@/server/ai-planning-service");
  }) => Promise<void> | void,
): Promise<void> {
  vi.resetModules();
  vi.doMock("@/server/supabase-ai-planning-service", () => ({
    listDestinationCandidates: vi.fn().mockResolvedValue([]),
    getPrimaryLodging: vi.fn().mockResolvedValue(null),
    getPlanningPreferences: vi.fn().mockResolvedValue(null),
    upsertPlanningPreferences: vi.fn(),
    ...mocks.supabaseAiPlanningService,
  }));
  vi.doMock("@/server/trip-access", () => ({
    requireTripRole: mocks.requireTripRole ?? vi.fn().mockResolvedValue(membership()),
  }));
  vi.doMock("@/server/trip-service", () => ({
    getTripById: mocks.getTripById ?? vi.fn().mockResolvedValue(tripRecord()),
  }));

  try {
    const service = await import("@/server/ai-planning-service");
    await run({ service });
  } finally {
    vi.doUnmock("@/server/supabase-ai-planning-service");
    vi.doUnmock("@/server/trip-access");
    vi.doUnmock("@/server/trip-service");
    vi.restoreAllMocks();
    vi.resetModules();
  }
}

function membership(role: TripMembership["role"] = "owner"): TripMembership {
  return {
    trip_id: 1,
    user_id: "user-1",
    role,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function tripRecord(overrides: Partial<Trip> = {}): Trip {
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

function candidateRecord(id: number) {
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
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}
