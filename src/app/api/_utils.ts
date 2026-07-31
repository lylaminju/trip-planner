import { NextResponse } from "next/server";
import type { Session, User } from "@supabase/supabase-js";

import {
  GoogleMapsUrlValidationError,
  ItineraryItemNotFoundError,
  PlaceNotFoundError,
  RouteSegmentNotFoundError,
  TripAccessDeniedError,
  TripValidationError,
  isConfigError,
  isRateLimitError,
  isServerFaultError,
  isUpstreamError,
} from "@/server/errors";
import { reportHandledRouteError } from "@/server/error-alerts";
import {
  getAuthenticatedUser,
  readAuthTokensFromCookieHeader,
  setAuthCookies,
} from "@/server/auth-session";
import {
  guestSessionSecret,
  readGuestIdFromCookieHeader,
} from "@/server/guest-session";
import { guestPrincipalId } from "@/server/principal";

export type JsonObject = Record<string, unknown>;

const MAX_ABS_LATITUDE = 90;
const MAX_ABS_LONGITUDE = 180;

export function isValidLatitude(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAX_ABS_LATITUDE
  );
}

export function isValidLongitude(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAX_ABS_LONGITUDE
  );
}

// Country codes gate an external, metered place search, so this shared validator
// (used by both the trip routes and the autocomplete route) fails closed instead
// of being duplicated. undefined/null => unrestricted; otherwise every entry must
// be a two-letter code and the list stays within the Places API's 15-code ceiling
// for includedRegionCodes.
const COUNTRY_CODE_PATTERN = /^[A-Za-z]{2}$/;
const MAX_COUNTRY_CODES = 15;

export function nullableCountryCodes(
  value: unknown,
): string[] | NextResponse | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    !Array.isArray(value) ||
    value.length > MAX_COUNTRY_CODES ||
    !value.every(
      (code) => typeof code === "string" && COUNTRY_CODE_PATTERN.test(code),
    )
  ) {
    return jsonError("Country codes must be two-letter codes.", 400);
  }

  return value;
}

export async function readJsonBody(
  request: Request,
): Promise<
  { ok: true; body: unknown } | { ok: false; response: NextResponse }
> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false, response: jsonError("Invalid JSON body.", 400) };
  }
}

export function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function requireAuthenticatedRequest(
  request: Request,
): Promise<
  | { ok: true; refreshedSession: Session | null; user: User }
  | { ok: false; response: NextResponse }
> {
  const { user, session } = await getAuthenticatedUser(
    readAuthTokensFromCookieHeader(request.headers.get("cookie")),
  );

  if (!user) {
    return { ok: false, response: jsonError("Authentication required.", 401) };
  }

  return { ok: true, refreshedSession: session, user };
}

export type RequestPrincipal =
  | { kind: "user"; user: User; principalId: string }
  | { kind: "guest"; guestId: string; principalId: string };

// Accepts a signed-in user first, then falls back to a validly signed guest
// cookie. Guest mode fails closed when GUEST_SESSION_SECRET is unset or the
// cookie is missing, malformed, or tampered with.
export async function requireUserOrGuestRequest(
  request: Request,
): Promise<
  | { ok: true; refreshedSession: Session | null; principal: RequestPrincipal }
  | { ok: false; response: NextResponse }
> {
  const { user, session } = await getAuthenticatedUser(
    readAuthTokensFromCookieHeader(request.headers.get("cookie")),
  );

  if (user) {
    return {
      ok: true,
      refreshedSession: session,
      principal: { kind: "user", user, principalId: user.id },
    };
  }

  const secret = guestSessionSecret();
  const guestId = secret
    ? readGuestIdFromCookieHeader(request.headers.get("cookie"), secret)
    : null;

  if (guestId) {
    return {
      ok: true,
      refreshedSession: null,
      principal: {
        kind: "guest",
        guestId,
        principalId: guestPrincipalId(guestId),
      },
    };
  }

  return { ok: false, response: jsonError("Authentication required.", 401) };
}

export function withRefreshedSession(
  response: NextResponse,
  refreshedSession: Session | null,
): NextResponse {
  if (!refreshedSession) {
    return response;
  }

  return setAuthCookies(response, refreshedSession);
}

// Handled errors never reach the Next.js error boundary, so they are invisible
// in production logs unless reported here.
function logRouteError(error: unknown): void {
  if (isServerFaultError(error)) {
    console.error(error);
    return;
  }

  if (isRateLimitError(error)) {
    console.warn(error);
  }
}

// `request` is optional so the 58 existing call sites keep working; passing it
// only adds route context to the alert.
export function mapRouteError(
  error: unknown,
  request?: { method: string; url: string },
): NextResponse | null {
  logRouteError(error);
  reportHandledRouteError(error, request);

  if (
    error instanceof PlaceNotFoundError ||
    error instanceof RouteSegmentNotFoundError ||
    error instanceof ItineraryItemNotFoundError
  ) {
    return jsonError(error.message, 404);
  }

  if (error instanceof TripAccessDeniedError) {
    return jsonError(error.message, 403);
  }

  if (
    error instanceof TripValidationError ||
    error instanceof GoogleMapsUrlValidationError
  ) {
    return jsonError(error.message, 400);
  }

  if (isRateLimitError(error)) {
    return jsonError(error.message, 429);
  }

  if (isConfigError(error)) {
    return jsonError(error.message, 503);
  }

  if (isUpstreamError(error)) {
    return jsonError(error.message, error.status);
  }

  return null;
}

export function asObject(value: unknown): JsonObject {
  return typeof value === "object" && value !== null
    ? (value as JsonObject)
    : {};
}

export async function readTripId(
  params: Promise<{ tripId: string }>,
): Promise<number | NextResponse> {
  const { tripId } = await params;
  const parsedTripId = Number(tripId);
  return Number.isInteger(parsedTripId)
    ? parsedTripId
    : jsonError("Invalid trip id.", 400);
}

export { isValid24HourTime, isValidIsoDate } from "@/lib/date-validation";
