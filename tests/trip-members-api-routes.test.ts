import { describe, expect, it, vi } from "vitest";

import type { TripRole } from "@/lib/types";

const MEMBERS_URL = "http://localhost/api/trips/1/members";

async function withMembersApiEnv(
  run: () => Promise<void>,
  options: { authenticated?: boolean; role?: TripRole | "none" } = {},
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
  vi.doMock("@/server/trip-access", async () => {
    const { TripAccessDeniedError } = await import("@/server/errors");
    const roles: TripRole[] = ["viewer", "owner"];
    return {
      requireTripRole: vi.fn(
        async (tripId: number, userId: string, minimumRole: TripRole) => {
          const role = options.role ?? "owner";
          if (
            role === "none" ||
            roles.indexOf(role) < roles.indexOf(minimumRole)
          ) {
            throw new TripAccessDeniedError(tripId);
          }

          return {
            trip_id: tripId,
            user_id: userId,
            role,
            created_at: "2026-01-01T00:00:00.000Z",
          };
        },
      ),
    };
  });
  vi.doMock("@/server/trip-members", () => ({
    addTripMemberByEmail: vi.fn().mockResolvedValue([
      { user_id: "user-1", role: "owner", username: "Lyla", profile_color: null },
      { user_id: "user-2", role: "viewer", username: "Sam", profile_color: null },
    ]),
    removeTripMember: vi.fn().mockResolvedValue([
      { user_id: "user-1", role: "owner", username: "Lyla", profile_color: null },
    ]),
  }));

  try {
    await run();
  } finally {
    vi.doUnmock("@/server/auth-session");
    vi.doUnmock("@/server/trip-access");
    vi.doUnmock("@/server/trip-members");
    vi.restoreAllMocks();
    vi.resetModules();
  }
}

function inviteRequest(body: unknown): Request {
  return new Request(MEMBERS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function membersParams(tripId = "1") {
  return { params: Promise.resolve({ tripId }) };
}

function memberParams(userId: string, tripId = "1") {
  return { params: Promise.resolve({ tripId, userId }) };
}

describe("trip members API routes", () => {
  it("adds a member by email for a trip owner", async () => {
    await withMembersApiEnv(async () => {
      const { POST } = await import("@/app/api/trips/[tripId]/members/route");
      const tripMembers = await import("@/server/trip-members");
      const response = await POST(
        inviteRequest({ email: " Friend@Example.com ", role: "viewer" }),
        membersParams(),
      );

      expect(response.status).toBe(201);
      expect(tripMembers.addTripMemberByEmail).toHaveBeenCalledWith(
        1,
        "friend@example.com",
        "viewer",
      );
      await expect(response.json()).resolves.toEqual({
        members: [
          expect.objectContaining({ user_id: "user-1", role: "owner" }),
          expect.objectContaining({ user_id: "user-2", role: "viewer" }),
        ],
      });
    });
  });

  it("returns 401 for unauthenticated invite requests", async () => {
    await withMembersApiEnv(
      async () => {
        const { POST } = await import(
          "@/app/api/trips/[tripId]/members/route"
        );
        const response = await POST(
          inviteRequest({ email: "friend@example.com", role: "viewer" }),
          membersParams(),
        );

        expect(response.status).toBe(401);
      },
      { authenticated: false },
    );
  });

  it("returns 403 when a viewer tries to invite", async () => {
    await withMembersApiEnv(
      async () => {
        const { POST } = await import(
          "@/app/api/trips/[tripId]/members/route"
        );
        const response = await POST(
          inviteRequest({ email: "friend@example.com", role: "viewer" }),
          membersParams(),
        );

        expect(response.status).toBe(403);
      },
      { role: "viewer" },
    );
  });

  it.each([
    ["missing email", { role: "viewer" }],
    ["malformed email", { email: "not-an-email", role: "viewer" }],
    ["non-string email", { email: 42, role: "viewer" }],
  ])("rejects invites with %s", async (_label, body) => {
    await withMembersApiEnv(async () => {
      const { POST } = await import("@/app/api/trips/[tripId]/members/route");
      const response = await POST(inviteRequest(body), membersParams());

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "A valid email is required.",
      });
    });
  });

  it.each([
    ["missing role", { email: "friend@example.com" }],
    ["unknown role", { email: "friend@example.com", role: "admin" }],
  ])("rejects invites with %s", async (_label, body) => {
    await withMembersApiEnv(async () => {
      const { POST } = await import("@/app/api/trips/[tripId]/members/route");
      const response = await POST(inviteRequest(body), membersParams());

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Member role must be owner or viewer.",
      });
    });
  });

  it("rejects invites for invalid trip ids", async () => {
    await withMembersApiEnv(async () => {
      const { POST } = await import("@/app/api/trips/[tripId]/members/route");
      const response = await POST(
        inviteRequest({ email: "friend@example.com", role: "viewer" }),
        membersParams("not-a-number"),
      );

      expect(response.status).toBe(400);
    });
  });

  it("surfaces validation failures from the member service as 400", async () => {
    await withMembersApiEnv(async () => {
      const { TripValidationError } = await import("@/server/errors");
      const tripMembers = await import("@/server/trip-members");
      vi.mocked(tripMembers.addTripMemberByEmail).mockRejectedValue(
        new TripValidationError("No account found for that email."),
      );

      const { POST } = await import("@/app/api/trips/[tripId]/members/route");
      const response = await POST(
        inviteRequest({ email: "ghost@example.com", role: "viewer" }),
        membersParams(),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "No account found for that email.",
      });
    });
  });

  it("removes a member for a trip owner", async () => {
    await withMembersApiEnv(async () => {
      const { DELETE } = await import(
        "@/app/api/trips/[tripId]/members/[userId]/route"
      );
      const tripMembers = await import("@/server/trip-members");
      const response = await DELETE(
        new Request(`${MEMBERS_URL}/user-2`, { method: "DELETE" }),
        memberParams("user-2"),
      );

      expect(response.status).toBe(200);
      expect(tripMembers.removeTripMember).toHaveBeenCalledWith(1, "user-2");
      await expect(response.json()).resolves.toEqual({
        members: [expect.objectContaining({ user_id: "user-1" })],
      });
    });
  });

  it("rejects removing yourself", async () => {
    await withMembersApiEnv(async () => {
      const { DELETE } = await import(
        "@/app/api/trips/[tripId]/members/[userId]/route"
      );
      const response = await DELETE(
        new Request(`${MEMBERS_URL}/user-1`, { method: "DELETE" }),
        memberParams("user-1"),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "You cannot remove yourself from a trip.",
      });
    });
  });

  it("returns 403 when a viewer tries to remove a member", async () => {
    await withMembersApiEnv(
      async () => {
        const { DELETE } = await import(
          "@/app/api/trips/[tripId]/members/[userId]/route"
        );
        const response = await DELETE(
          new Request(`${MEMBERS_URL}/user-2`, { method: "DELETE" }),
          memberParams("user-2"),
        );

        expect(response.status).toBe(403);
      },
      { role: "viewer" },
    );
  });
});
