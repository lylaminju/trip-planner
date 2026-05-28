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
    }));

    try {
      const { getRouteGeometry } =
        await import("@/server/route-geometry-service");
      await expect(getRouteGeometry(1, 1)).rejects.toMatchObject({
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
});
