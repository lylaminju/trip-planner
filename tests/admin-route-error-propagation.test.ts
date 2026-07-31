import { afterEach, describe, expect, it, vi } from "vitest";

const ADMIN_EMAIL = "admin@example.com";
const STORE_FAILURE = "Supabase unavailable";
const REQUEST_URL = "https://example.com/api/admin/usage?tz=UTC";

function mockAuthAs(email: string): void {
  vi.doMock("@/server/auth-session", () => ({
    getAuthenticatedUser: vi
      .fn()
      .mockResolvedValue({ user: { id: "user-1", email }, session: null }),
    readAuthTokensFromCookieHeader: vi
      .fn()
      .mockReturnValue({ accessToken: "token", refreshToken: "refresh" }),
    setAuthCookies: vi.fn((response: unknown) => response),
  }));
}

type AdminRoute = {
  label: string;
  storeModule: string;
  storeExport: string;
  load: () => Promise<{ GET: (request: Request) => Promise<Response> }>;
};

const ADMIN_ROUTES: AdminRoute[] = [
  {
    label: "usage",
    storeModule: "@/server/supabase-admin-usage-store",
    storeExport: "getAllUsersUsageStats",
    load: () => import("@/app/api/admin/usage/route"),
  },
  {
    label: "guest activity",
    storeModule: "@/server/supabase-admin-guest-activity-store",
    storeExport: "getGuestActivityStats",
    load: () => import("@/app/api/admin/guest-activity/route"),
  },
];

async function loadRoute(
  route: AdminRoute,
  options: { email?: string; storeResult: () => unknown },
) {
  vi.resetModules();
  vi.stubEnv("ADMIN_EMAIL", ADMIN_EMAIL);
  mockAuthAs(options.email ?? ADMIN_EMAIL);
  vi.doMock(route.storeModule, () => ({
    [route.storeExport]: vi.fn(options.storeResult),
  }));
  return route.load();
}

describe.each(ADMIN_ROUTES)("admin $label route", (route) => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  // Swallowing the failure into a 500 response would hide it from both
  // reporters: `mapRouteError` sees nothing to map, and Next's onRequestError
  // hook only fires for errors that actually escape the handler.
  it("lets an unexpected store failure escape so instrumentation can report it", async () => {
    const { GET } = await loadRoute(route, {
      storeResult: () => {
        throw new Error(STORE_FAILURE);
      },
    });

    await expect(GET(new Request(REQUEST_URL))).rejects.toThrow(STORE_FAILURE);
  });

  it("still refuses non-admin accounts without reaching the store", async () => {
    const { GET } = await loadRoute(route, {
      email: "someone-else@example.com",
      storeResult: () => {
        throw new Error(STORE_FAILURE);
      },
    });

    expect((await GET(new Request(REQUEST_URL))).status).toBe(403);
  });

  it("returns the stats it loaded on the success path", async () => {
    const { GET } = await loadRoute(route, { storeResult: () => [] });

    const response = await GET(new Request(REQUEST_URL));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});
