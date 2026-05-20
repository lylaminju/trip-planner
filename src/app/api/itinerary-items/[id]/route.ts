import { NextResponse } from "next/server";

import {
  asObject,
  isValid24HourTime,
  isValidIsoDate,
  jsonError,
  mapRouteError,
  readJsonBody,
} from "@/app/api/_utils";
import { editItineraryItem, removeItineraryItem } from "@/server/place-service";

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
  const visitDate = nullableDateOrUndefined(body.visit_date);
  if (visitDate instanceof Response) {
    return visitDate;
  }

  const visitTime = nullableTimeOrUndefined(body.visit_time);
  if (visitTime instanceof Response) {
    return visitTime;
  }

  try {
    return NextResponse.json(
      editItineraryItem(itemId, {
        visit_date: visitDate,
        visit_time: visitTime,
        notes: nullableStringOrUndefined(body.notes),
      }),
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) {
      return response;
    }

    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const itemId = Number(id);

  if (!Number.isInteger(itemId)) {
    return jsonError("Invalid itinerary item id.", 400);
  }

  try {
    return NextResponse.json(removeItineraryItem(itemId));
  } catch (error) {
    const response = mapRouteError(error);
    if (response) {
      return response;
    }

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

function nullableDateOrUndefined(value: unknown): string | NextResponse | null | undefined {
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

function nullableTimeOrUndefined(value: unknown): string | NextResponse | null | undefined {
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
