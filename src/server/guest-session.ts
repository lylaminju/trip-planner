import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

import { parseCookieHeader } from "./auth-session";

const GUEST_ID_COOKIE = "trip-planner-guest-id";
// Long-lived so per-guest daily quotas follow the same browser across visits,
// even though each guest trip expires much sooner.
const GUEST_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
// Guest trips are ephemeral demos; expired ones are deleted outright.
export const GUEST_TRIP_TTL_HOURS = 48;

const GUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const GUEST_SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;

// Guest mode is disabled (fails closed) when the secret is unset.
export function guestSessionSecret(): string | null {
  const secret = process.env.GUEST_SESSION_SECRET?.trim();
  return secret ? secret : null;
}

export function mintGuestId(): string {
  return randomUUID();
}

export function guestCookieValue(guestId: string, secret: string): string {
  return `${guestId}.${signGuestId(guestId, secret)}`;
}

export function verifyGuestCookieValue(
  value: string | null | undefined,
  secret: string,
): string | null {
  if (!value) return null;

  const separator = value.indexOf(".");
  if (separator === -1) return null;

  const guestId = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (
    !GUEST_ID_PATTERN.test(guestId) ||
    !GUEST_SIGNATURE_PATTERN.test(signature)
  ) {
    return null;
  }

  // Both sides are validated 64-char hex strings, so the buffers share a
  // length and the comparison stays constant-time.
  const matches = timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(signGuestId(guestId, secret), "hex"),
  );
  return matches ? guestId : null;
}

export function readGuestIdFromCookieHeader(
  cookieHeader: string | null,
  secret: string,
): string | null {
  return verifyGuestCookieValue(
    parseCookieHeader(cookieHeader).get(GUEST_ID_COOKIE) ?? null,
    secret,
  );
}

export function readGuestIdFromCookieStore(
  cookieStore: { get(name: string): { value: string } | undefined },
  secret: string,
): string | null {
  return verifyGuestCookieValue(
    cookieStore.get(GUEST_ID_COOKIE)?.value ?? null,
    secret,
  );
}

export function setGuestCookie(
  response: NextResponse,
  guestId: string,
  secret: string,
): NextResponse {
  response.cookies.set(GUEST_ID_COOKIE, guestCookieValue(guestId, secret), {
    httpOnly: true,
    maxAge: GUEST_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

function signGuestId(guestId: string, secret: string): string {
  return createHmac("sha256", secret).update(guestId).digest("hex");
}
