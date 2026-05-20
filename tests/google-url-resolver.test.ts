import { afterEach, describe, expect, it, vi } from "vitest";

import { resolvePlaceUrl } from "@/server/place-service";
import { resolveGoogleMapsUrl } from "@/server/google-url-resolver";

const CANONICAL_URL =
  "https://www.google.com/maps/place/Oculus/@40.7118042,-74.0118498,17z";
const STABLE_FETCH_ERROR = "Google Maps URL request failed";

describe("resolveGoogleMapsUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns parsed direct Google Maps URLs without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("fetch should not be called on the fast path"),
    );

    await expect(resolveGoogleMapsUrl(CANONICAL_URL)).resolves.toEqual({
      google_maps_url: CANONICAL_URL,
      name: "Oculus",
      latitude: 40.7118042,
      longitude: -74.0118498,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects disallowed non-Google hosts without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("should not fetch"));

    await expect(resolveGoogleMapsUrl("https://example.com/maps/place/Oculus")).rejects.toThrow(
      "Unsupported Google Maps URL host",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects non-HTTPS short Google Maps URLs without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("should not fetch"));

    await expect(resolveGoogleMapsUrl("http://maps.app.goo.gl/abc123")).rejects.toThrow(
      "Google Maps short URLs must use https",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("follows redirects for short Google Maps URLs before parsing", async () => {
    const shortUrl = "https://maps.app.goo.gl/abc123";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockRedirectResponse(CANONICAL_URL))
      .mockResolvedValueOnce(mockOkResponse(CANONICAL_URL));

    await expect(resolveGoogleMapsUrl(shortUrl)).resolves.toEqual({
      google_maps_url: CANONICAL_URL,
      name: "Oculus",
      latitude: 40.7118042,
      longitude: -74.0118498,
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(1, shortUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": "trip-planner-local/0.1",
      },
      signal: expect.any(AbortSignal),
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(2, CANONICAL_URL, {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": "trip-planner-local/0.1",
      },
      signal: expect.any(AbortSignal),
    });
  });

  it("rejects redirect chains that leave the Google allowlist", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockRedirectResponse("https://evil.example.com/not-google"),
    );

    await expect(resolveGoogleMapsUrl("https://maps.app.goo.gl/abc123")).rejects.toThrow(
      "Unsupported Google Maps redirect host",
    );
  });

  it("throws when the redirect response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      url: "https://maps.app.goo.gl/abc123",
    } as Response);

    await expect(resolveGoogleMapsUrl("https://maps.app.goo.gl/abc123")).rejects.toThrow(
      "Google Maps URL request failed: 502 Bad Gateway",
    );
  });

  it("throws when the redirected final URL is not a recognized Google Maps place URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      url: "https://example.com/not-google",
    } as Response);

    await expect(resolveGoogleMapsUrl("https://maps.app.goo.gl/abc123")).rejects.toThrow(
      "Resolved Google Maps URL was not parseable",
    );
  });

  it("normalizes transport failures into a stable fetch error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1"));

    await expect(resolveGoogleMapsUrl("https://maps.app.goo.gl/abc123")).rejects.toThrow(
      STABLE_FETCH_ERROR,
    );
  });

  it("aborts redirect resolution when the fetch times out", async () => {
    vi.useFakeTimers();

    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          signal?.addEventListener("abort", () => {
            reject(signal.reason ?? new Error("aborted"));
          });
        }),
    );

    const pending = resolveGoogleMapsUrl("https://maps.app.goo.gl/timeout");
    const assertion = expect(pending).rejects.toThrow("Google Maps URL resolution timed out");

    await vi.advanceTimersByTimeAsync(5_000);

    await assertion;
  });
});

describe("resolvePlaceUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns resolved place URL fields from the service export", async () => {
    const shortUrl = "https://maps.app.goo.gl/service123";

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      url: CANONICAL_URL,
    } as Response);

    await expect(resolvePlaceUrl(shortUrl)).resolves.toEqual({
      google_maps_url: CANONICAL_URL,
      name: "Oculus",
      latitude: 40.7118042,
      longitude: -74.0118498,
    });
  });
});

function mockOkResponse(url: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    url,
    headers: new Headers(),
  } as Response;
}

function mockRedirectResponse(location: string, status = 302): Response {
  return {
    ok: false,
    status,
    statusText: "Found",
    url: "",
    headers: new Headers({ location }),
  } as Response;
}
