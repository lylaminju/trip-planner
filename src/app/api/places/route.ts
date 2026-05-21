import { NextResponse } from "next/server";

import {
  asObject,
  isValid24HourTime,
  isValidIsoDate,
  jsonError,
  mapRouteError,
  readJsonBody,
} from "@/app/api/_utils";
import {
  createPlaceForRequest,
  getPlannerSnapshotForRequest,
  resolvePlaceUrl,
} from "@/server/place-service";

export async function GET() {
  return NextResponse.json(await getPlannerSnapshotForRequest());
}

export async function POST(request: Request) {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = asObject(parsedBody.body);
  const googleMapsUrl = stringOrNull(body.google_maps_url);
  if (!googleMapsUrl) {
    return jsonError("Google Maps URL is required.", 400);
  }

  const visitDate = dateOrNull(body.visit_date);
  if (visitDate instanceof Response) {
    return visitDate;
  }

  const visitTime = timeOrNull(body.visit_time);
  if (visitTime instanceof Response) {
    return visitTime;
  }

  try {
    const resolved = await resolvePlaceUrl(googleMapsUrl);
    const name = stringOrNull(body.name) ?? resolved.name;
    if (!name) {
      return jsonError("Name is required when it cannot be resolved from the URL.", 400);
    }
    if (resolved.latitude === null || resolved.longitude === null) {
      return jsonError("Could not resolve coordinates from the Google Maps URL.", 400);
    }

    return NextResponse.json(
      await createPlaceForRequest({
        name,
        address: stringOrNull(body.address),
        notes: stringOrNull(body.notes),
        google_maps_url: resolved.google_maps_url,
        place_id: null,
        google_place_token: null,
        google_internal_ids: null,
        source_list_url: null,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        visit_date: visitDate,
        visit_time: visitTime,
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

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dateOrNull(value: unknown): string | NextResponse | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return jsonError("Visit date must be YYYY-MM-DD.", 400);
  }

  const text = stringOrNull(value);
  return text && isValidIsoDate(text) ? text : jsonError("Visit date must be YYYY-MM-DD.", 400);
}

function timeOrNull(value: unknown): string | NextResponse | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return jsonError("Visit time must be HH:MM.", 400);
  }

  const text = stringOrNull(value);
  return text && isValid24HourTime(text) ? text : jsonError("Visit time must be HH:MM.", 400);
}
