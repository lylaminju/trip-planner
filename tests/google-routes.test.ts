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
});
