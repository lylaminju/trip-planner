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
import {
  editItineraryItemForRequest,
  removeItineraryItemForRequest,
} from "@/server/place-service";

import { readEntityParams, type TripEntityParams } from "../../_utils";

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
  const visitDate = nullableDateOrUndefined(body.visit_date);
  if (visitDate instanceof Response) {
    return visitDate;
  }

  const visitTime = nullableTimeOrUndefined(body.visit_time);
  if (visitTime instanceof Response) {
    return visitTime;
  }

  try {
    return withRefreshedSession(
      NextResponse.json(
        await editItineraryItemForRequest(
          parsedParams.tripId,
          auth.principal.principalId,
          parsedParams.id,
          {
            visit_date: visitDate,
            visit_time: visitTime,
            notes: nullableStringOrUndefined(body.notes),
          },
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

export async function DELETE(request: Request, { params }: TripEntityParams) {
  const auth = await requireUserOrGuestRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const parsedParams = await readEntityParams(params, "itinerary item");
  if (parsedParams instanceof Response) {
    return parsedParams;
  }

  try {
    return withRefreshedSession(
      NextResponse.json(
        await removeItineraryItemForRequest(
          parsedParams.tripId,
          auth.principal.principalId,
          parsedParams.id,
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

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nullableStringOrUndefined(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return stringOrUndefined(value);
}

function nullableDateOrUndefined(
  value: unknown,
): string | NextResponse | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    return jsonError("Visit date must be YYYY-MM-DD.", 400);
  }
  const text = stringOrUndefined(value);
  if (!text || !isValidIsoDate(text)) {
    return jsonError("Visit date must be YYYY-MM-DD.", 400);
  }
  return text;
}

function nullableTimeOrUndefined(
  value: unknown,
): string | NextResponse | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    return jsonError("Visit time must be HH:MM.", 400);
  }
  const text = stringOrUndefined(value);
  if (!text || !isValid24HourTime(text)) {
    return jsonError("Visit time must be HH:MM.", 400);
  }
  return text;
}
