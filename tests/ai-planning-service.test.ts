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
