import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DestinationSearchUnavailableError,
  fetchDestinationSuggestions,
} from "@/lib/places-api";

// Builds a minimal Response-like object; postPlaces only reads status, ok, and
// json().
function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(response)));
}

describe("fetchDestinationSuggestions error mapping", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Guest mode: the places routes are user-only, so autocomplete returns 401.
  // The field must fall back to pasting a link, not a dead "No matching places".
  it("maps a 401 to the paste-a-link fallback", async () => {
    stubFetch(jsonResponse(401, { error: "Authentication required." }));

    await expect(
      fetchDestinationSuggestions("hotel", "session-token"),
    ).rejects.toBeInstanceOf(DestinationSearchUnavailableError);
  });

  it("maps a 429 to the paste-a-link fallback", async () => {
    stubFetch(jsonResponse(429, { error: "Rate limited." }));

    await expect(
      fetchDestinationSuggestions("hotel", "session-token"),
    ).rejects.toBeInstanceOf(DestinationSearchUnavailableError);
  });

  // Other failures must not be dressed up as the fallback, so real faults stay
  // visible instead of silently steering users to paste a link.
  it("surfaces other failures as a generic error", async () => {
    stubFetch(jsonResponse(500, { error: "Destination search failed." }));

    const rejection = fetchDestinationSuggestions("hotel", "session-token");
    await expect(rejection).rejects.toThrow("Destination search failed.");
    await expect(rejection).rejects.not.toBeInstanceOf(
      DestinationSearchUnavailableError,
    );
  });

  it("returns the suggestions array on success", async () => {
    const suggestions = [
      { place_id: "p1", primary_text: "Hotel One", secondary_text: "City" },
    ];
    stubFetch(jsonResponse(200, { suggestions }));

    await expect(
      fetchDestinationSuggestions("hotel", "session-token"),
    ).resolves.toEqual(suggestions);
  });
});
