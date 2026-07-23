import { NextResponse } from "next/server";

import {
  asObject,
  isValid24HourTime,
  isValidIsoDate,
  jsonError,
  mapRouteError,
  readJsonBody,
  requireUserOrGuestRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { scheduleItineraryItemForRequest } from "@/server/place-service";

import { readEntityParams, type TripEntityParams } from "../../../_utils";

export async function PATCH(request: Request, { params }: TripEntityParams) {
  const auth = await requireUserOrGuestRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const parsedParams = await readEntityParams(params, "itinerary item");
  if (parsedParams instanceof Response) {
    return parsedParams;
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = asObject(parsedBody.body);
  const visitDate = parseDate(body);
  if (visitDate instanceof Response) {
    return visitDate;
  }

  const visitTime = parseTime(body);
  if (visitTime instanceof Response) {
    return visitTime;
  }

  try {
    return withRefreshedSession(
      NextResponse.json(
        await scheduleItineraryItemForRequest(
          parsedParams.tripId,
          auth.principal.principalId,
          parsedParams.id,
          visitDate,
          visitTime,
        ),
      ),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}

function parseDate(
  body: Record<string, unknown>,
): string | NextResponse | null {
  if (!Object.prototype.hasOwnProperty.call(body, "visit_date")) {
    return jsonError("Visit date is required.", 400);
  }

  const value = body.visit_date;
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return jsonError("Visit date must be YYYY-MM-DD.", 400);
  }

  const text = value.trim();
  return isValidIsoDate(text)
    ? text
    : jsonError("Visit date must be YYYY-MM-DD.", 400);
}

function parseTime(
  body: Record<string, unknown>,
): string | NextResponse | null {
  if (body.visit_date === null) {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(body, "visit_time")) {
    return null;
  }

  const value = body.visit_time;
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return jsonError("Visit time must be HH:MM.", 400);
  }

  const text = value.trim();
  return isValid24HourTime(text)
    ? text
    : jsonError("Visit time must be HH:MM.", 400);
}
