import { afterEach, describe, expect, it, vi } from "vitest";

const PROFILE_URL = "http://localhost/api/profile";

const updateUserProfile = vi.fn();

async function patchProfile(body: unknown): Promise<Response> {
  vi.resetModules();
  updateUserProfile.mockClear().mockImplementation(
    async (_userId: string, updates: unknown) => updates,
  );
  vi.doMock("@/server/auth-session", () => ({
    getAuthenticatedUser: vi
      .fn()
      .mockResolvedValue({ user: { id: "user-1" }, session: null }),
    readAuthTokensFromCookieHeader: vi.fn().mockReturnValue({
      accessToken: "token",
      refreshToken: "refresh",
    }),
    setAuthCookies: vi.fn((response) => response),
    updateUserProfile: (...args: unknown[]) => updateUserProfile(...args),
  }));

  const { PATCH } = await import("@/app/api/profile/route");
  return PATCH(
    new Request(PROFILE_URL, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

afterEach(() => {
  vi.doUnmock("@/server/auth-session");
});

describe("PATCH /api/profile", () => {
  it("saves whitelisted dietary tags and trimmed notes", async () => {
    const response = await patchProfile({
      username: "Lyla",
      profileColor: "#0f766e",
      dietaryTags: ["vegetarian", "nut-allergy", "vegetarian"],
      dietaryNotes: "  no cilantro  ",
    });

    expect(response.status).toBe(200);
    expect(updateUserProfile).toHaveBeenCalledWith("user-1", {
      username: "Lyla",
      profileColor: "#0f766e",
      dietaryTags: ["vegetarian", "nut-allergy"],
      dietaryNotes: "no cilantro",
    });
  });

  it("keeps dietary fields empty when the client omits them", async () => {
    const response = await patchProfile({
      username: "Lyla",
      profileColor: "#0f766e",
    });

    expect(response.status).toBe(200);
    expect(updateUserProfile).toHaveBeenCalledWith("user-1", {
      username: "Lyla",
      profileColor: "#0f766e",
      dietaryTags: [],
      dietaryNotes: null,
    });
  });

  it.each([
    ["unknown tag", { dietaryTags: ["gluten-free", "carnivore"] }],
    ["non-array tags", { dietaryTags: "vegan" }],
    ["non-string tag entries", { dietaryTags: [42] }],
    ["non-string notes", { dietaryNotes: 42 }],
    ["notes over the length cap", { dietaryNotes: "x".repeat(201) }],
  ])("rejects %s with 400 and never persists", async (_label, overrides) => {
    const response = await patchProfile({
      username: "Lyla",
      profileColor: "#0f766e",
      ...overrides,
    });

    expect(response.status).toBe(400);
    expect(updateUserProfile).not.toHaveBeenCalled();
  });
});
