import { describe, expect, it, vi } from "vitest";

import type { PlaceInsert } from "@/server/place-inputs";

const baseInput: PlaceInsert = {
  name: "Museum",
  address: "123 Main St",
  google_maps_url: "https://www.google.com/maps",
  place_id: null,
  google_place_token: null,
  google_internal_ids: null,
  source_list_url: null,
  latitude: 40.7128,
  longitude: -74.006,
  visit_date: null,
  visit_time: null,
  notes: "Existing notes",
};

async function withFreshTestEnv(
  run: () => Promise<void> | void,
  options: { authenticated?: boolean } = {},
): Promise<void> {
  vi.resetModules();
  vi.doMock("@/server/supabase-place-service", async () => {
    const { createFakeSupabasePlaceService } =
      await import("./fake-supabase-place-service");
    return createFakeSupabasePlaceService();
  });
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

  try {
    await run();
  } finally {
    vi.doUnmock("@/server/auth-session");
    vi.doUnmock("@/server/place-service");
    vi.doUnmock("@/server/supabase-place-service");
    vi.restoreAllMocks();
    vi.resetModules();
  }
}

describe("API routes transport behavior", () => {
  it("returns 401 for unauthenticated planner API requests", async () => {
    await withFreshTestEnv(
      async () => {
        const { GET } = await import("@/app/api/places/route");
        const response = await GET(new Request("http://localhost/api/places"));

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
          error: "Authentication required.",
        });
      },
      { authenticated: false },
    );
  });

  it("returns 400 for malformed JSON in all mutating routes", async () => {
    await withFreshTestEnv(async () => {
      const placesRoute = await import("@/app/api/places/route");
      const placeRoute = await import("@/app/api/places/[id]/route");
      const scheduleRoute =
        await import("@/app/api/places/[id]/schedule/route");
      const segmentRoute = await import("@/app/api/route-segments/[id]/route");

      const cases = [
        placesRoute.POST(malformedJsonRequest("POST")),
        placeRoute.PATCH(malformedJsonRequest("PATCH"), params("1")),
        scheduleRoute.PATCH(malformedJsonRequest("PATCH"), params("1")),
        segmentRoute.PATCH(malformedJsonRequest("PATCH"), params("1")),
      ];

      const responses = await Promise.all(cases);
      for (const response of responses) {
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
          error: "Invalid JSON body.",
        });
      }
    });
  });

  it("maps URL validation failures to 400 on place creation", async () => {
    await withFreshTestEnv(async () => {
      const { GoogleMapsUrlValidationError } = await import("@/server/errors");

      vi.doMock("@/server/place-service", async () => {
        const actual = await vi.importActual<
          typeof import("@/server/place-service")
        >("@/server/place-service");

        return {
          ...actual,
          resolvePlaceUrl: vi
            .fn()
            .mockRejectedValue(
              new GoogleMapsUrlValidationError(
                "Unsupported Google Maps URL host",
              ),
            ),
        };
      });

      const { POST } = await import("@/app/api/places/route");
      const response = await POST(
        jsonRequest("POST", {
          google_maps_url: "https://example.com/maps/place/Bad",
        }),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Unsupported Google Maps URL host",
      });
    });
  });

  it("maps URL upstream timeouts to 504 on place edit", async () => {
    await withFreshTestEnv(async () => {
      const { GoogleMapsUrlUpstreamError } = await import("@/server/errors");
      const service = await import("@/server/place-service");
      const created = await service.createPlace(baseInput);

      vi.doMock("@/server/place-service", async () => {
        const actual = await vi.importActual<
          typeof import("@/server/place-service")
        >("@/server/place-service");

        return {
          ...actual,
          resolvePlaceUrl: vi
            .fn()
            .mockRejectedValue(
              new GoogleMapsUrlUpstreamError(
                "Google Maps URL resolution timed out",
                504,
              ),
            ),
        };
      });

      const { PATCH } = await import("@/app/api/places/[id]/route");
      const response = await PATCH(
        jsonRequest("PATCH", {
          google_maps_url: "https://maps.app.goo.gl/timeout",
        }),
        params(String(created.places[0].id)),
      );

      expect(response.status).toBe(504);
      await expect(response.json()).resolves.toEqual({
        error: "Google Maps URL resolution timed out",
      });
    });
  });

  it("maps URL upstream failures to 502 on place creation", async () => {
    await withFreshTestEnv(async () => {
      const { GoogleMapsUrlUpstreamError } = await import("@/server/errors");

      vi.doMock("@/server/place-service", async () => {
        const actual = await vi.importActual<
          typeof import("@/server/place-service")
        >("@/server/place-service");

        return {
          ...actual,
          resolvePlaceUrl: vi
            .fn()
            .mockRejectedValue(
              new GoogleMapsUrlUpstreamError(
                "Google Maps upstream failed",
                502,
              ),
            ),
        };
      });

      const { POST } = await import("@/app/api/places/route");
      const response = await POST(
        jsonRequest("POST", {
          google_maps_url: "https://maps.app.goo.gl/unavailable",
        }),
      );

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({
        error: "Google Maps upstream failed",
      });
    });
  });

  it("returns 400 for invalid date/time updates instead of ignoring them", async () => {
    await withFreshTestEnv(async () => {
      const service = await import("@/server/place-service");
      const created = await service.createPlace(baseInput);
      const { PATCH } = await import("@/app/api/places/[id]/route");

      const badDateResponse = await PATCH(
        jsonRequest("PATCH", { visit_date: "06/01/2026" }),
        params(String(created.places[0].id)),
      );
      expect(badDateResponse.status).toBe(400);
      await expect(badDateResponse.json()).resolves.toEqual({
        error: "Visit date must be YYYY-MM-DD.",
      });

      const badTimeResponse = await PATCH(
        jsonRequest("PATCH", { visit_time: "9am" }),
        params(String(created.places[0].id)),
      );
      expect(badTimeResponse.status).toBe(400);
      await expect(badTimeResponse.json()).resolves.toEqual({
        error: "Visit time must be HH:MM.",
      });

      const impossibleDateResponse = await PATCH(
        jsonRequest("PATCH", { visit_date: "2026-02-31" }),
        params(String(created.places[0].id)),
      );
      expect(impossibleDateResponse.status).toBe(400);
      await expect(impossibleDateResponse.json()).resolves.toEqual({
        error: "Visit date must be YYYY-MM-DD.",
      });

      const impossibleTimeResponse = await PATCH(
        jsonRequest("PATCH", { visit_time: "29:61" }),
        params(String(created.places[0].id)),
      );
      expect(impossibleTimeResponse.status).toBe(400);
      await expect(impossibleTimeResponse.json()).resolves.toEqual({
        error: "Visit time must be HH:MM.",
      });
    });
  });

  it("does not clear schedule when visit_date is omitted or invalid in the schedule route", async () => {
    await withFreshTestEnv(async () => {
      const service = await import("@/server/place-service");
      const created = await service.createPlace({
        ...baseInput,
        visit_date: "2026-06-01",
        visit_time: "09:00",
      });
      const placeId = String(created.places[0].id);
      const { PATCH } = await import("@/app/api/places/[id]/schedule/route");

      const missingDateResponse = await PATCH(
        jsonRequest("PATCH", { visit_time: null }),
        params(placeId),
      );
      expect(missingDateResponse.status).toBe(400);
      await expect(missingDateResponse.json()).resolves.toEqual({
        error: "Visit date is required.",
      });

      const invalidDateResponse = await PATCH(
        jsonRequest("PATCH", { visit_date: "06/01/2026", visit_time: null }),
        params(placeId),
      );
      expect(invalidDateResponse.status).toBe(400);
      await expect(invalidDateResponse.json()).resolves.toEqual({
        error: "Visit date must be YYYY-MM-DD.",
      });

      await expect(service.getPlannerSnapshot()).resolves.toMatchObject({
        itineraryItems: [
          expect.objectContaining({
            visit_date: "2026-06-01",
            visit_time: "09:00",
          }),
        ],
      });
    });
  });

  it("returns 404 for unknown ids across mutation routes", async () => {
    await withFreshTestEnv(async () => {
      const placeRoute = await import("@/app/api/places/[id]/route");
      const scheduleRoute =
        await import("@/app/api/places/[id]/schedule/route");
      const segmentRoute = await import("@/app/api/route-segments/[id]/route");

      const editResponse = await placeRoute.PATCH(
        jsonRequest("PATCH", { name: "Updated" }),
        params("999"),
      );
      expect(editResponse.status).toBe(404);
      await expect(editResponse.json()).resolves.toEqual({
        error: "Place 999 not found",
      });

      const deleteResponse = await placeRoute.DELETE(
        new Request("http://localhost/api/places/999", { method: "DELETE" }),
        params("999"),
      );
      expect(deleteResponse.status).toBe(404);
      await expect(deleteResponse.json()).resolves.toEqual({
        error: "Place 999 not found",
      });

      const scheduleResponse = await scheduleRoute.PATCH(
        jsonRequest("PATCH", { visit_date: null, visit_time: null }),
        params("999"),
      );
      expect(scheduleResponse.status).toBe(404);
      await expect(scheduleResponse.json()).resolves.toEqual({
        error: "Place 999 not found",
      });

      const segmentResponse = await segmentRoute.PATCH(
        jsonRequest("PATCH", { mode: "walking" }),
        params("999"),
      );
      expect(segmentResponse.status).toBe(404);
      await expect(segmentResponse.json()).resolves.toEqual({
        error: "Route segment 999 not found",
      });
    });
  });

  it("returns cached route geometry for a route segment", async () => {
    await withFreshTestEnv(async () => {
      vi.doMock("@/server/route-geometry-service", () => ({
        getRouteGeometry: vi.fn().mockResolvedValue({
          segment_id: 12,
          status: "ok",
          encoded_polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
        }),
      }));

      const { GET } =
        await import("@/app/api/route-segments/[id]/geometry/route");
      const response = await GET(
        new Request("http://localhost/api/route-segments/12/geometry"),
        params("12"),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        segment_id: 12,
        status: "ok",
        encoded_polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
      });
    });
  });

  it("treats empty nullable text fields as clears on place edit", async () => {
    await withFreshTestEnv(async () => {
      const service = await import("@/server/place-service");
      const created = await service.createPlace(baseInput);
      const { PATCH } = await import("@/app/api/places/[id]/route");

      const response = await PATCH(
        jsonRequest("PATCH", { address: "", notes: "   " }),
        params(String(created.places[0].id)),
      );

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.places[0]).toMatchObject({
        address: null,
        notes: null,
      });
    });
  });

  it("allows date/time edits without re-resolving an unchanged Google Maps URL", async () => {
    await withFreshTestEnv(async () => {
      const service = await import("@/server/place-service");
      const created = await service.createPlace({
        ...baseInput,
        google_maps_url:
          "https://www.google.com/maps/search/?api=1&query=JGSTAY%20-%20Times%20Square",
      });
      const placeId = String(created.places[0].id);
      const { PATCH } = await import("@/app/api/places/[id]/route");

      const response = await PATCH(
        jsonRequest("PATCH", {
          google_maps_url:
            "https://www.google.com/maps/search/?api=1&query=JGSTAY%20-%20Times%20Square",
          visit_date: "2026-06-02",
          visit_time: "09:00",
        }),
        params(placeId),
      );

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.itineraryItems[0]).toMatchObject({
        visit_date: "2026-06-02",
        visit_time: "09:00",
      });
    });
  });

  it("edits itinerary item schedule and notes independently from place notes", async () => {
    await withFreshTestEnv(async () => {
      const service = await import("@/server/place-service");
      const created = await service.createPlace({
        ...baseInput,
        notes: "Place note",
        visit_date: "2026-06-01",
        visit_time: "09:00",
      });
      const { PATCH } = await import("@/app/api/itinerary-items/[id]/route");

      const response = await PATCH(
        jsonRequest("PATCH", {
          visit_date: "2026-06-02",
          visit_time: "10:00",
          notes: "Visit note",
        }),
        params(String(created.itineraryItems[0].id)),
      );

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.places[0]).toMatchObject({ notes: "Place note" });
      expect(payload.itineraryItems[0]).toMatchObject({
        visit_date: "2026-06-02",
        visit_time: "10:00",
        notes: "Visit note",
      });
    });
  });
});

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/test", {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function malformedJsonRequest(method: string): Request {
  return new Request("http://localhost/test", {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: "{",
  });
}
