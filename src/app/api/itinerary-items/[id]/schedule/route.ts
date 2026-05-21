import { NextResponse } from "next/server";

import {
  asObject,
  isValid24HourTime,
  isValidIsoDate,
  jsonError,
  mapRouteError,
  readJsonBody,
} from "@/app/api/_utils";
import { scheduleItineraryItemForRequest } from "@/server/place-service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const itemId = Number(id);

  if (!Number.isInteger(itemId)) {
    return jsonError("Invalid itinerary item id.", 400);
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
    return NextResponse.json(await scheduleItineraryItemForRequest(itemId, visitDate, visitTime));
  } catch (error) {
    const response = mapRouteError(error);
    if (response) {
      return response;
    }

    throw error;
  }
}

function parseDate(body: Record<string, unknown>): string | NextResponse | null {
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
  return isValidIsoDate(text) ? text : jsonError("Visit date must be YYYY-MM-DD.", 400);
}

function parseTime(body: Record<string, unknown>): string | NextResponse | null {
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
  return isValid24HourTime(text) ? text : jsonError("Visit time must be HH:MM.", 400);
}
