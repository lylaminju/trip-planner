import { describe, expect, it, vi } from "vitest";

async function withLookupApiEnv(
  run: () => Promise<void>,
  options: { authenticated?: boolean } = {},
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
  vi.doMock("@/server/profile-lookup", () => ({
    lookupProfileByEmail: vi
      .fn()
      .mockResolvedValue({ found: true, username: "Sam" }),
  }));

  try {
    await run();
  } finally {
    vi.doUnmock("@/server/auth-session");
    vi.doUnmock("@/server/profile-lookup");
    vi.restoreAllMocks();
    vi.resetModules();
  }
}

function lookupRequest(query: string): Request {
  return new Request(`http://localhost/api/users/lookup${query}`);
}

describe("user lookup API route", () => {
  it("resolves a full email to a single account, normalizing the input", async () => {
    await withLookupApiEnv(async () => {
      const { GET } = await import("@/app/api/users/lookup/route");
      const lookup = await import("@/server/profile-lookup");
      const response = await GET(lookupRequest("?email=%20Sam%40Example.com%20"));

      expect(response.status).toBe(200);
      expect(lookup.lookupProfileByEmail).toHaveBeenCalledWith(
        "sam@example.com",
      );
      await expect(response.json()).resolves.toEqual({
        found: true,
        username: "Sam",
      });
    });
  });

  it("returns 401 for unauthenticated lookups", async () => {
    await withLookupApiEnv(
      async () => {
        const { GET } = await import("@/app/api/users/lookup/route");
        const response = await GET(lookupRequest("?email=sam@example.com"));

        expect(response.status).toBe(401);
      },
      { authenticated: false },
    );
  });

  it.each([
    ["missing email", ""],
    ["malformed email", "?email=not-an-email"],
    ["partial input", "?email=sam"],
  ])("rejects %s without querying the store", async (_label, query) => {
    await withLookupApiEnv(async () => {
      const { GET } = await import("@/app/api/users/lookup/route");
      const lookup = await import("@/server/profile-lookup");
      const response = await GET(lookupRequest(query));

      expect(response.status).toBe(400);
      expect(lookup.lookupProfileByEmail).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toEqual({
        error: "A valid email is required.",
      });
    });
  });

  it("reports a missing account as found:false", async () => {
    await withLookupApiEnv(async () => {
      const lookup = await import("@/server/profile-lookup");
      vi.mocked(lookup.lookupProfileByEmail).mockResolvedValue({
        found: false,
        username: null,
      });

      const { GET } = await import("@/app/api/users/lookup/route");
      const response = await GET(lookupRequest("?email=ghost@example.com"));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        found: false,
        username: null,
      });
    });
  });
});
