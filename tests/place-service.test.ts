import { describe, expect, it, vi } from "vitest";

import type { PlannerSnapshot, Trip, TripMembership } from "@/lib/types";
import type { PlaceCreateInput } from "@/server/place-inputs";

const baseInput: PlaceCreateInput = {
  name: "Museum",
  address: null,
  google_maps_url: "https://www.google.com/maps",
  google_place_id: null,
  google_place_token: null,
  google_internal_ids: null,
  source_list_url: null,
  latitude: 40.7128,
  longitude: -74.006,
  visit_date: null,
  visit_time: null,
  notes: null,
  links: [],
};

const plannerSnapshot: PlannerSnapshot = {
  places: [],
  itineraryItems: [],
  routeSegments: [],
};

describe("place-service request boundary", () => {
  it("delegates direct planner mutations to the Supabase place service", async () => {
    const createPlace = vi.fn().mockResolvedValue(plannerSnapshot);

    await withMockedPlaceService(
      {
        supabasePlaceService: { createPlace },
      },
      async ({ service }) => {
        await expect(service.createPlace(1, baseInput)).resolves.toBe(
          plannerSnapshot,
        );
      },
    );

    expect(createPlace).toHaveBeenCalledWith(1, baseInput);
  });

  it("requires owner access before creating a place for a request", async () => {
    const requireTripRole = vi.fn().mockResolvedValue(membership("owner"));
    const createPlace = vi.fn().mockResolvedValue(plannerSnapshot);

    await withMockedPlaceService(
      {
        requireTripRole,
        supabasePlaceService: { createPlace },
      },
      async ({ service }) => {
        await expect(
          service.createPlaceForRequest(1, "user-1", baseInput),
        ).resolves.toBe(plannerSnapshot);
      },
    );

    expect(requireTripRole).toHaveBeenCalledWith(1, "user-1", "owner");
    expect(createPlace).toHaveBeenCalledWith(1, baseInput);
  });

  it("requires owner access before deleting all places for a request", async () => {
    const requireTripRole = vi.fn().mockResolvedValue(membership("owner"));
    const removeAllPlaces = vi.fn().mockResolvedValue(plannerSnapshot);

    await withMockedPlaceService(
      {
        requireTripRole,
        supabasePlaceService: { removeAllPlaces },
      },
      async ({ service }) => {
        await expect(
          service.removeAllPlacesForRequest(1, "user-1"),
        ).resolves.toBe(plannerSnapshot);
      },
    );

    expect(requireTripRole).toHaveBeenCalledWith(1, "user-1", "owner");
    expect(removeAllPlaces).toHaveBeenCalledWith(1);
  });

  it("requires owner access before deleting all itinerary items for a request", async () => {
    const requireTripRole = vi.fn().mockResolvedValue(membership("owner"));
    const removeAllItineraryItems = vi.fn().mockResolvedValue(plannerSnapshot);

    await withMockedPlaceService(
      {
        requireTripRole,
        supabasePlaceService: { removeAllItineraryItems },
      },
      async ({ service }) => {
        await expect(
          service.removeAllItineraryItemsForRequest(1, "user-1"),
        ).resolves.toBe(plannerSnapshot);
      },
    );

    expect(requireTripRole).toHaveBeenCalledWith(1, "user-1", "owner");
    expect(removeAllItineraryItems).toHaveBeenCalledWith(1);
  });

  it("assembles trip planner initial data with the viewer role and snapshot", async () => {
    const trip = tripRecord();
    const requireTripRole = vi.fn().mockResolvedValue(membership("viewer"));
    const getTripById = vi.fn().mockResolvedValue(trip);
    const getPlannerSnapshot = vi.fn().mockResolvedValue(plannerSnapshot);

    await withMockedPlaceService(
      {
        getTripById,
        requireTripRole,
        supabasePlaceService: { getPlannerSnapshot },
      },
      async ({ service }) => {
        await expect(
          service.getTripPlannerInitialDataForRequest(1, "user-1"),
        ).resolves.toEqual({
          trip,
          role: "viewer",
          members: [],
          plannerSnapshot,
        });
      },
    );

    expect(requireTripRole).toHaveBeenCalledWith(1, "user-1", "viewer");
    expect(getTripById).toHaveBeenCalledWith(1);
    expect(getPlannerSnapshot).toHaveBeenCalledWith(1);
  });
});

async function withMockedPlaceService(
  mocks: {
    getTripById?: ReturnType<typeof vi.fn>;
    requireTripRole?: ReturnType<typeof vi.fn>;
    supabasePlaceService?: Partial<typeof import("@/server/supabase-place-service")>;
  },
  run: (context: {
    service: typeof import("@/server/place-service");
  }) => Promise<void> | void,
): Promise<void> {
  vi.resetModules();
  vi.doMock("@/server/supabase-place-service", () => ({
    getPlannerSnapshot: vi.fn().mockResolvedValue(plannerSnapshot),
    createPlace: vi.fn().mockResolvedValue(plannerSnapshot),
    editPlace: vi.fn().mockResolvedValue(plannerSnapshot),
    removePlace: vi.fn().mockResolvedValue(plannerSnapshot),
    removeAllPlaces: vi.fn().mockResolvedValue(plannerSnapshot),
    schedulePlace: vi.fn().mockResolvedValue(plannerSnapshot),
    scheduleItineraryItem: vi.fn().mockResolvedValue(plannerSnapshot),
    editItineraryItem: vi.fn().mockResolvedValue(plannerSnapshot),
    removeItineraryItem: vi.fn().mockResolvedValue(plannerSnapshot),
    removeAllItineraryItems: vi.fn().mockResolvedValue(plannerSnapshot),
    setRouteSegmentMode: vi.fn().mockResolvedValue(plannerSnapshot),
    getPlaceById: vi.fn(),
    ...mocks.supabasePlaceService,
  }));
  vi.doMock("@/server/trip-access", () => ({
    requireTripRole: mocks.requireTripRole ?? vi.fn().mockResolvedValue(membership()),
  }));
  vi.doMock("@/server/trip-service", () => ({
    getTripById: mocks.getTripById ?? vi.fn().mockResolvedValue(tripRecord()),
  }));
  vi.doMock("@/server/trip-members", () => ({
    listTripMembers: vi.fn().mockResolvedValue(new Map()),
  }));

  try {
    const service = await import("@/server/place-service");
    await run({ service });
  } finally {
    vi.doUnmock("@/server/supabase-place-service");
    vi.doUnmock("@/server/trip-access");
    vi.doUnmock("@/server/trip-service");
    vi.doUnmock("@/server/trip-members");
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

function tripRecord(): Trip {
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
  };
}
