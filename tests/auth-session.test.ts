import { describe, expect, it } from "vitest";

import { readAuthTokensFromCookieHeader } from "@/server/auth-session";

describe("auth-session helpers", () => {
  it("parses auth tokens from the cookie header", () => {
    expect(
      readAuthTokensFromCookieHeader(
        "trip-planner-access-token=abc; trip-planner-refresh-token=def",
      ),
    ).toEqual({
      accessToken: "abc",
      refreshToken: "def",
    });
  });

  it("returns null tokens when cookies are missing", () => {
    expect(readAuthTokensFromCookieHeader(null)).toEqual({
      accessToken: null,
      refreshToken: null,
    });
  });
});
