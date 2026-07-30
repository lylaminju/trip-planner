import { afterEach, describe, expect, it, vi } from "vitest";

import { computeGoogleRoute } from "@/server/google-routes";

describe("Google Routes adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("can request duration without polyline payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        routes: [{ duration: "540s" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      computeGoogleRoute({
        apiKey: "test-routes-key",
        from: { latitude: 40, longitude: -74 },
        to: { latitude: 40.1, longitude: -73.9 },
        mode: "transit",
        includePolyline: false,
      }),
    ).resolves.toEqual({
      status: "ok",
      duration_seconds: 540,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit.headers["X-Goog-FieldMask"]).toBe("routes.duration");
    expect(JSON.parse(requestInit.body)).not.toHaveProperty(
      "polylineEncoding",
    );
  });

  it("forwards departureTime only when one is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ routes: [{ duration: "540s" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const route = {
      apiKey: "test-routes-key",
      from: { latitude: 40, longitude: -74 },
      to: { latitude: 40.1, longitude: -73.9 },
      mode: "transit" as const,
      includePolyline: false,
    };

    await computeGoogleRoute(route);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty(
      "departureTime",
    );

    await computeGoogleRoute({
      ...route,
      departureTime: "2026-08-04T14:00:00.000Z",
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).departureTime).toBe(
      "2026-08-04T14:00:00.000Z",
    );
  });

  // Billing guard, not a style preference: Compute Routes Essentials is the only
  // SKU this project is budgeted for. routingPreference (TRAFFIC_AWARE) bills as
  // Pro, TWO_WHEELER as Enterprise, and intermediates/optimizeWaypointOrder at a
  // higher rate, so a request must never carry a field outside this set.
  it("sends only Compute Routes Essentials request fields", async () => {
    const allowedBodyFields = [
      "origin",
      "destination",
      "travelMode",
      "departureTime",
      "polylineEncoding",
      "polylineQuality",
    ];
    const allowedFieldMasks = [
      "routes.duration",
      "routes.duration,routes.polyline.encodedPolyline",
    ];
    const modes = ["walking", "transit", "bicycling", "driving"] as const;

    for (const mode of modes) {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          routes: [{ duration: "540s", polyline: { encodedPolyline: "abc" } }],
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await computeGoogleRoute({
        apiKey: "test-routes-key",
        from: { latitude: 40, longitude: -74 },
        to: { latitude: 40.1, longitude: -73.9 },
        mode,
        departureTime: "2026-08-04T14:00:00.000Z",
      });

      const [, requestInit] = fetchMock.mock.calls[0];
      const body = JSON.parse(requestInit.body);
      expect(Object.keys(body).sort()).toEqual(
        Object.keys(body)
          .filter((field) => allowedBodyFields.includes(field))
          .sort(),
      );
      expect(body.travelMode).not.toBe("TWO_WHEELER");
      expect(allowedFieldMasks).toContain(
        requestInit.headers["X-Goog-FieldMask"],
      );
    }
  });
});
