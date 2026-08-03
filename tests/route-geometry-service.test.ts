import { describe, expect, it, vi } from "vitest";

describe("route-geometry-service", () => {
  it("requires a server-side Google Routes key", async () => {
    const originalRoutesKey = process.env.GOOGLE_MAPS_ROUTES_API_KEY;
    const originalGoogleMapsKey = process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_MAPS_ROUTES_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;

    vi.resetModules();
    vi.doMock("@/server/supabase-route-geometry-service", () => ({
      getRouteGeometry: vi.fn(),
      cachedRouteDurationSeconds: vi.fn().mockResolvedValue(null),
      saveRouteDurationSeconds: vi.fn(),
    }));

    try {
      const { getRouteDurationSeconds, getRouteGeometry } =
        await import("@/server/route-geometry-service");
      await expect(getRouteGeometry(1, 1)).rejects.toMatchObject({
        name: "GoogleRoutesConfigError",
      });
      await expect(
        getRouteDurationSeconds({
          from: { latitude: 40, longitude: -74 },
          to: { latitude: 40.1, longitude: -73.9 },
          mode: "walking",
        }),
      ).rejects.toMatchObject({
        name: "GoogleRoutesConfigError",
      });
    } finally {
      vi.doUnmock("@/server/supabase-route-geometry-service");
      vi.resetModules();
      if (originalRoutesKey === undefined) {
        delete process.env.GOOGLE_MAPS_ROUTES_API_KEY;
      } else {
        process.env.GOOGLE_MAPS_ROUTES_API_KEY = originalRoutesKey;
      }
      if (originalGoogleMapsKey === undefined) {
        delete process.env.GOOGLE_MAPS_API_KEY;
      } else {
        process.env.GOOGLE_MAPS_API_KEY = originalGoogleMapsKey;
      }
    }
  });

  it("delegates route geometry to the Supabase-backed service", async () => {
    const originalRoutesKey = process.env.GOOGLE_MAPS_ROUTES_API_KEY;
    process.env.GOOGLE_MAPS_ROUTES_API_KEY = "test-routes-key";

    const getSupabaseRouteGeometry = vi.fn().mockResolvedValue({
      segment_id: 12,
      status: "ok",
      encoded_polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
    });

    vi.resetModules();
    vi.doMock("@/server/supabase-route-geometry-service", () => ({
      getRouteGeometry: getSupabaseRouteGeometry,
    }));

    try {
      const { getRouteGeometry } =
        await import("@/server/route-geometry-service");
      await expect(getRouteGeometry(1, 12)).resolves.toEqual({
        segment_id: 12,
        status: "ok",
        encoded_polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
      });
      expect(getSupabaseRouteGeometry).toHaveBeenCalledWith(
        1,
        12,
        "test-routes-key",
        undefined,
        null,
      );
    } finally {
      vi.doUnmock("@/server/supabase-route-geometry-service");
      vi.resetModules();
      if (originalRoutesKey === undefined) {
        delete process.env.GOOGLE_MAPS_ROUTES_API_KEY;
      } else {
        process.env.GOOGLE_MAPS_ROUTES_API_KEY = originalRoutesKey;
      }
    }
  });

  it("computes point-to-point route duration with the server Routes key", async () => {
    const originalRoutesKey = process.env.GOOGLE_MAPS_ROUTES_API_KEY;
    process.env.GOOGLE_MAPS_ROUTES_API_KEY = "test-routes-key";

    const computeGoogleRoute = vi.fn().mockResolvedValue({
      status: "ok",
      duration_seconds: 540,
    });
    const saveRouteDurationSeconds = vi.fn().mockResolvedValue(undefined);

    vi.resetModules();
    vi.doMock("@/server/google-routes", () => ({
      computeGoogleRoute,
    }));
    vi.doMock("@/server/supabase-route-geometry-service", () => ({
      getRouteGeometry: vi.fn(),
      cachedRouteDurationSeconds: vi.fn().mockResolvedValue(null),
      saveRouteDurationSeconds,
    }));

    try {
      const { getRouteDurationSeconds } =
        await import("@/server/route-geometry-service");
      const from = { latitude: 40, longitude: -74 };
      const to = { latitude: 40.1, longitude: -73.9 };

      await expect(
        getRouteDurationSeconds({ from, to, mode: "transit" }),
      ).resolves.toBe(540);
      expect(computeGoogleRoute).toHaveBeenCalledWith({
        apiKey: "test-routes-key",
        from,
        to,
        mode: "transit",
        includePolyline: false,
      });
      // The paid-for duration must land in the cache, or every later probe of
      // this route buys the same answer again.
      expect(saveRouteDurationSeconds).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "transit",
          from_latitude: 40,
          from_longitude: -74,
          to_latitude: 40.1,
          to_longitude: -73.9,
        }),
        expect.objectContaining({ status: "ok", duration_seconds: 540 }),
      );
    } finally {
      vi.doUnmock("@/server/google-routes");
      vi.doUnmock("@/server/supabase-route-geometry-service");
      vi.resetModules();
      if (originalRoutesKey === undefined) {
        delete process.env.GOOGLE_MAPS_ROUTES_API_KEY;
      } else {
        process.env.GOOGLE_MAPS_ROUTES_API_KEY = originalRoutesKey;
      }
    }
  });

  // A duration the map already paid for must not be bought again: this is the
  // whole cost saving of routing duration lookups through the cache.
  it("reuses a cached duration instead of calling Google", async () => {
    const originalRoutesKey = process.env.GOOGLE_MAPS_ROUTES_API_KEY;
    process.env.GOOGLE_MAPS_ROUTES_API_KEY = "test-routes-key";

    const computeGoogleRoute = vi.fn();
    const recordGoogleRoutesCall = vi.fn();

    vi.resetModules();
    vi.doMock("@/server/google-routes", () => ({ computeGoogleRoute }));
    vi.doMock("@/server/supabase-route-geometry-service", () => ({
      getRouteGeometry: vi.fn(),
      cachedRouteDurationSeconds: vi
        .fn()
        .mockResolvedValue({ durationSeconds: 315 }),
      saveRouteDurationSeconds: vi.fn(),
    }));
    vi.doMock("@/server/supabase-google-routes-usage-store", () => ({
      recordGoogleRoutesCall,
    }));

    try {
      const { getRouteDurationSeconds } =
        await import("@/server/route-geometry-service");

      await expect(
        getRouteDurationSeconds({
          from: { latitude: 40, longitude: -74 },
          to: { latitude: 40.1, longitude: -73.9 },
          mode: "walking",
          userId: "user-1",
        }),
      ).resolves.toBe(315);
      expect(computeGoogleRoute).not.toHaveBeenCalled();
      expect(recordGoogleRoutesCall).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("@/server/google-routes");
      vi.doUnmock("@/server/supabase-route-geometry-service");
      vi.doUnmock("@/server/supabase-google-routes-usage-store");
      vi.resetModules();
      if (originalRoutesKey === undefined) {
        delete process.env.GOOGLE_MAPS_ROUTES_API_KEY;
      } else {
        process.env.GOOGLE_MAPS_ROUTES_API_KEY = originalRoutesKey;
      }
    }
  });

  // A cached no_route is a definitive answer, not a miss: paying Google to
  // re-learn that no route exists is the exact waste the cache prevents.
  it("returns null for a cached no_route without calling Google", async () => {
    const originalRoutesKey = process.env.GOOGLE_MAPS_ROUTES_API_KEY;
    process.env.GOOGLE_MAPS_ROUTES_API_KEY = "test-routes-key";

    const computeGoogleRoute = vi.fn();

    vi.resetModules();
    vi.doMock("@/server/google-routes", () => ({ computeGoogleRoute }));
    vi.doMock("@/server/supabase-route-geometry-service", () => ({
      getRouteGeometry: vi.fn(),
      cachedRouteDurationSeconds: vi
        .fn()
        .mockResolvedValue({ durationSeconds: null }),
      saveRouteDurationSeconds: vi.fn(),
    }));

    try {
      const { getRouteDurationSeconds } =
        await import("@/server/route-geometry-service");

      await expect(
        getRouteDurationSeconds({
          from: { latitude: 40, longitude: -74 },
          to: { latitude: 40.1, longitude: -73.9 },
          mode: "walking",
        }),
      ).resolves.toBeNull();
      expect(computeGoogleRoute).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("@/server/google-routes");
      vi.doUnmock("@/server/supabase-route-geometry-service");
      vi.resetModules();
      if (originalRoutesKey === undefined) {
        delete process.env.GOOGLE_MAPS_ROUTES_API_KEY;
      } else {
        process.env.GOOGLE_MAPS_ROUTES_API_KEY = originalRoutesKey;
      }
    }
  });
});
