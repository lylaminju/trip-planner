import { vi } from "vitest";

import type { TripRole } from "@/lib/types";

export async function withFreshTripApiEnv(
  run: () => Promise<void> | void,
  options: { authenticated?: boolean; role?: TripRole } = {},
): Promise<void> {
  vi.resetModules();
  vi.doMock("@/server/auth-session", () => ({
    getAuthenticatedUser: vi.fn().mockResolvedValue({
      user: options.authenticated === false ? null : { id: "user-1" },
      session: null,
    }),
    readAuthTokensFromCookieHeader: vi.fn().mockReturnValue({
      accessToken: "token",
      refreshToken: "refresh",
    }),
    setAuthCookies: vi.fn((response) => response),
  }));
  vi.doMock("@/server/trip-service", async () => {
    const { TripAccessDeniedError } = await import("@/server/errors");
    const role = options.role ?? "owner";
    const baseTrip = {
      id: 1,
      created_by: "user-1",
      name: "New York City",
      destination: "New York City",
      destination_slug: "new-york-city",
      start_date: "2026-05-27",
      end_date: "2026-05-29",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      role,
    };

    return {
      listTripsForRequest: vi.fn().mockResolvedValue([baseTrip]),
      createTripForRequest: vi.fn().mockImplementation((_userId, input) =>
        Promise.resolve({
          ...baseTrip,
          ...input,
          id: 2,
          created_by: "user-1",
          role: "owner",
        }),
      ),
      updateTripForRequest: vi.fn().mockImplementation((tripId, _userId) => {
        if (role !== "owner") throw new TripAccessDeniedError(tripId);
        return Promise.resolve(baseTrip);
      }),
      deleteTripForRequest: vi.fn().mockImplementation((tripId) => {
        if (role !== "owner") throw new TripAccessDeniedError(tripId);
        return Promise.resolve();
      }),
    };
  });

  vi.doMock("@/server/place-service", () => ({
    getPlannerSnapshot: vi.fn().mockResolvedValue({
      places: [],
      itineraryItems: [],
      routeSegments: [],
    }),
  }));

  try {
    await run();
  } finally {
    vi.doUnmock("@/server/auth-session");
    vi.doUnmock("@/server/trip-service");
    vi.doUnmock("@/server/place-service");
    vi.restoreAllMocks();
    vi.resetModules();
  }
}
