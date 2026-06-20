import { NextResponse } from "next/server";

import {
  asObject,
  isValidIsoDate,
  jsonError,
  mapRouteError,
  readJsonBody,
  requireAuthenticatedRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import {
  deleteTripForRequest,
  updateTripForRequest,
  type TripUpdateInput,
} from "@/server/trip-service";

import { readTripIdParam, type TripParams } from "./_utils";

export async function PATCH(request: Request, { params }: TripParams) {
  const auth = await requireAuthenticatedRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const tripId = await readTripIdParam(params);
  if (tripId instanceof Response) {
    return tripId;
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const parsedInput = parseTripUpdateInput(parsedBody.body);
  if (parsedInput instanceof Response) {
    return parsedInput;
  }

  try {
    return withRefreshedSession(
      NextResponse.json({
        trip: await updateTripForRequest(tripId, auth.user.id, parsedInput),
      }),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE(request: Request, { params }: TripParams) {
  const auth = await requireAuthenticatedRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const tripId = await readTripIdParam(params);
  if (tripId instanceof Response) {
    return tripId;
  }

  try {
    await deleteTripForRequest(tripId, auth.user.id);
    return withRefreshedSession(
      NextResponse.json({ ok: true }),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}

function parseTripUpdateInput(value: unknown): TripUpdateInput | NextResponse {
  const body = asObject(value);
  const input: TripUpdateInput = {};

  if ("name" in body) {
    const name = stringOrNull(body.name);
    if (!name) {
      return jsonError("Trip name is required.", 400);
    }
    input.name = name;
  }

  if ("destination" in body) {
    const destination = stringOrNull(body.destination);
    if (!destination) {
      return jsonError("Trip destination is required.", 400);
    }
    input.destination = destination;
  }

  if ("start_date" in body) {
    const startDate = nullableDate(body.start_date, "Trip start date");
    if (startDate instanceof Response) return startDate;
    input.start_date = startDate;
  }

  if ("end_date" in body) {
    const endDate = nullableDate(body.end_date, "Trip end date");
    if (endDate instanceof Response) return endDate;
    input.end_date = endDate;
  }

  if (
    input.start_date &&
    input.end_date &&
    input.start_date > input.end_date
  ) {
    return jsonError(
      "Trip start date must be before or equal to end date.",
      400,
    );
  }

  return input;
}

function nullableDate(
  value: unknown,
  label: string,
): string | NextResponse | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return jsonError(`${label} must be YYYY-MM-DD.`, 400);
  }

  const text = stringOrNull(value);
  return text && isValidIsoDate(text)
    ? text
    : jsonError(`${label} must be YYYY-MM-DD.`, 400);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
