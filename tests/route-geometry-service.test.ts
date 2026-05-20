import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { PlaceInsert } from "@/server/place-repository";

const baseInput: PlaceInsert = {
  name: "Museum",
  address: null,
  google_maps_url: "https://www.google.com/maps",
  place_id: null,
  google_place_token: null,
  google_internal_ids: null,
  source_list_url: null,
  latitude: 40.7128,
  longitude: -74.006,
  visit_date: "2026-06-01",
  visit_time: "09:00",
  notes: null,
};

async function withFreshRouteGeometryService(
  run: (modules: {
    placeService: typeof import("@/server/place-service");
    routeGeometryService: typeof import("@/server/route-geometry-service");
  }) => Promise<void> | void,
  options: {
    googleMapsRoutesApiKey?: string | null;
    googleMapsApiKey?: string | null;
    nextPublicGoogleMapsApiKey?: string | null;
  } = {},
): Promise<void> {
  const tempDir = mkdtempSync(path.join(tmpdir(), "trip-planner-routes-"));
  const dbPath = path.join(tempDir, "trip-planner.sqlite");
  const originalDbPath = process.env.TRIP_PLANNER_DB_PATH;
  const originalRoutesKey = process.env.GOOGLE_MAPS_ROUTES_API_KEY;
  const originalGoogleMapsKey = process.env.GOOGLE_MAPS_API_KEY;
  const originalPublicGoogleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  process.env.TRIP_PLANNER_DB_PATH = dbPath;
  setOptionalEnv(
    "GOOGLE_MAPS_ROUTES_API_KEY",
    Object.hasOwn(options, "googleMapsRoutesApiKey") ? options.googleMapsRoutesApiKey : "test-routes-key",
  );
  setOptionalEnv("GOOGLE_MAPS_API_KEY", options.googleMapsApiKey);
  setOptionalEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", options.nextPublicGoogleMapsApiKey);
  vi.resetModules();

  try {
    const placeService = await import("@/server/place-service");
    const routeGeometryService = await import("@/server/route-geometry-service");
    await run({ placeService, routeGeometryService });
  } finally {
    vi.restoreAllMocks();
    vi.resetModules();

    if (originalDbPath === undefined) {
      delete process.env.TRIP_PLANNER_DB_PATH;
    } else {
      process.env.TRIP_PLANNER_DB_PATH = originalDbPath;
    }

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

    if (originalPublicGoogleMapsKey === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = originalPublicGoogleMapsKey;
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
}

function setOptionalEnv(name: string, value: string | null | undefined): void {
  if (value === undefined || value === null) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

describe("route-geometry-service", () => {
  it("caches successful route geometry by segment, mode, and coordinates", async () => {
    await withFreshRouteGeometryService(async ({ placeService, routeGeometryService }) => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            routes: [{ polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" } }],
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      placeService.createPlace(baseInput);
      const snapshot = placeService.createPlace({
        ...baseInput,
        name: "Park",
        latitude: 40.758,
        longitude: -73.9855,
        visit_time: "10:00",
      });
      const segmentId = snapshot.routeSegments[0].id;

      await expect(routeGeometryService.getRouteGeometry(segmentId)).resolves.toMatchObject({
        segment_id: segmentId,
        status: "ok",
        encoded_polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
      });
      await expect(routeGeometryService.getRouteGeometry(segmentId)).resolves.toMatchObject({
        segment_id: segmentId,
        status: "ok",
        encoded_polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("caches no-route results to avoid repeating billable misses", async () => {
    await withFreshRouteGeometryService(async ({ placeService, routeGeometryService }) => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ routes: [] }), { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);

      placeService.createPlace(baseInput);
      const snapshot = placeService.createPlace({
        ...baseInput,
        name: "Park",
        latitude: 40.758,
        longitude: -73.9855,
        visit_time: "10:00",
      });
      const segmentId = snapshot.routeSegments[0].id;

      await expect(routeGeometryService.getRouteGeometry(segmentId)).resolves.toMatchObject({
        segment_id: segmentId,
        status: "no_route",
      });
      await expect(routeGeometryService.getRouteGeometry(segmentId)).resolves.toMatchObject({
        segment_id: segmentId,
        status: "no_route",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("requests Google route geometry with the selected segment mode", async () => {
    await withFreshRouteGeometryService(async ({ placeService, routeGeometryService }) => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            routes: [{ polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" } }],
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      placeService.createPlace(baseInput);
      const snapshot = placeService.createPlace({
        ...baseInput,
        name: "Park",
        latitude: 40.758,
        longitude: -73.9855,
        visit_time: "10:00",
      });
      const segmentId = snapshot.routeSegments[0].id;
      placeService.setRouteSegmentMode(segmentId, "bicycling");

      await routeGeometryService.getRouteGeometry(segmentId);

      const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { travelMode: string };
      expect(request.travelMode).toBe("BICYCLE");
    });
  });

  it("does not use the public browser key for server route geometry requests", async () => {
    await withFreshRouteGeometryService(
      async ({ placeService, routeGeometryService }) => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        placeService.createPlace(baseInput);
        const snapshot = placeService.createPlace({
          ...baseInput,
          name: "Park",
          latitude: 40.758,
          longitude: -73.9855,
          visit_time: "10:00",
        });
        const segmentId = snapshot.routeSegments[0].id;

        await expect(routeGeometryService.getRouteGeometry(segmentId)).rejects.toMatchObject({
          name: "GoogleRoutesConfigError",
        });
        expect(fetchMock).not.toHaveBeenCalled();
      },
      {
        googleMapsRoutesApiKey: null,
        googleMapsApiKey: null,
        nextPublicGoogleMapsApiKey: "browser-only-key",
      },
    );
  });

  it("refreshes cached route geometry after 30 days", async () => {
    await withFreshRouteGeometryService(async ({ placeService, routeGeometryService }) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              routes: [{ polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" } }],
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              routes: [{ polyline: { encodedPolyline: "mfp_I__vpAilAyu@" } }],
            }),
            { status: 200 },
          ),
        );
      vi.stubGlobal("fetch", fetchMock);

      placeService.createPlace(baseInput);
      const snapshot = placeService.createPlace({
        ...baseInput,
        name: "Park",
        latitude: 40.758,
        longitude: -73.9855,
        visit_time: "10:00",
      });
      const segmentId = snapshot.routeSegments[0].id;

      await routeGeometryService.getRouteGeometry(segmentId);

      const { getDatabase } = await import("@/server/db");
      getDatabase()
        .prepare("UPDATE route_geometry_cache SET updated_at = datetime('now', '-31 days')")
        .run();

      await expect(routeGeometryService.getRouteGeometry(segmentId)).resolves.toMatchObject({
        segment_id: segmentId,
        status: "ok",
        encoded_polyline: "mfp_I__vpAilAyu@",
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
