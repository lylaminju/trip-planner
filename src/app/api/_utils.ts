import { NextResponse } from "next/server";

import {
  GoogleRoutesConfigError,
  GoogleRoutesUpstreamError,
  ItineraryItemNotFoundError,
  GoogleMapsUrlUpstreamError,
  GoogleMapsUrlValidationError,
  PlaceNotFoundError,
  RouteSegmentNotFoundError,
} from "@/server/errors";

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

export function mapRouteError(error: unknown): NextResponse | null {
  if (
    error instanceof PlaceNotFoundError ||
    error instanceof RouteSegmentNotFoundError ||
    error instanceof ItineraryItemNotFoundError
  ) {
    return jsonError(error.message, 404);
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
