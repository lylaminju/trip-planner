import { describe, expect, it } from "vitest";

import {
  guestCookieValue,
  mintGuestId,
  readGuestIdFromCookieHeader,
  verifyGuestCookieValue,
} from "@/server/guest-session";

const SECRET = "test-guest-secret";

describe("guest-session cookie signing", () => {
  it("round-trips a minted guest id through sign and verify", () => {
    const guestId = mintGuestId();
    const cookieValue = guestCookieValue(guestId, SECRET);

    expect(verifyGuestCookieValue(cookieValue, SECRET)).toBe(guestId);
  });

  it("reads a signed guest id from a cookie header", () => {
    const guestId = mintGuestId();
    const header = `other=1; trip-planner-guest-id=${guestCookieValue(guestId, SECRET)}`;

    expect(readGuestIdFromCookieHeader(header, SECRET)).toBe(guestId);
  });

  it("rejects a tampered guest id", () => {
    const cookieValue = guestCookieValue(mintGuestId(), SECRET);
    const otherId = mintGuestId();
    const forged = `${otherId}.${cookieValue.split(".")[1]}`;

    expect(verifyGuestCookieValue(forged, SECRET)).toBeNull();
  });

  it("rejects a signature minted with a different secret", () => {
    const guestId = mintGuestId();
    const cookieValue = guestCookieValue(guestId, "another-secret");

    expect(verifyGuestCookieValue(cookieValue, SECRET)).toBeNull();
  });

  it.each([
    ["empty value", ""],
    ["missing signature", "8e7a1c0e-1111-4222-8333-444455556666"],
    ["non-uuid guest id", `not-a-uuid.${"a".repeat(64)}`],
    ["non-hex signature", `8e7a1c0e-1111-4222-8333-444455556666.${"z".repeat(64)}`],
    ["truncated signature", `8e7a1c0e-1111-4222-8333-444455556666.${"a".repeat(40)}`],
    ["uppercase guest id", `8E7A1C0E-1111-4222-8333-444455556666.${"a".repeat(64)}`],
  ])("fails closed on malformed input: %s", (_label, value) => {
    expect(verifyGuestCookieValue(value, SECRET)).toBeNull();
  });

  it("returns null when the cookie header lacks the guest cookie", () => {
    expect(readGuestIdFromCookieHeader(null, SECRET)).toBeNull();
    expect(readGuestIdFromCookieHeader("other=1", SECRET)).toBeNull();
  });
});
