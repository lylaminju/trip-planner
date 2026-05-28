import { NextResponse } from "next/server";
import type { Session, User } from "@supabase/supabase-js";

import {
  GoogleRoutesConfigError,
  GoogleRoutesUpstreamError,
  ItineraryItemNotFoundError,
  GoogleMapsUrlUpstreamError,
  GoogleMapsUrlValidationError,
  PlaceNotFoundError,
  RouteSegmentNotFoundError,
  TripAccessDeniedError,
} from "@/server/errors";
import {
  getAuthenticatedUser,
  readAuthTokensFromCookieHeader,
  setAuthCookies,
} from "@/server/auth-session";

export type JsonObject = Record<string, unknown>;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_24_HOUR_PATTERN = /^(\d{2}):(\d{2})$/;

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

export function withRefreshedSession(
  response: NextResponse,
  refreshedSession: Session | null,
): NextResponse {
  if (!refreshedSession) {
    return response;
  }

  return setAuthCookies(response, refreshedSession);
}

export function mapRouteError(error: unknown): NextResponse | null {
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

  if (error instanceof GoogleMapsUrlValidationError) {
    return jsonError(error.message, 400);
  }

  if (error instanceof GoogleMapsUrlUpstreamError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof GoogleRoutesConfigError) {
    return jsonError(error.message, 503);
  }

  if (error instanceof GoogleRoutesUpstreamError) {
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

export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValid24HourTime(value: string): boolean {
  const match = TIME_24_HOUR_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}
