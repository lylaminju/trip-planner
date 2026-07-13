import { NextResponse } from "next/server";

import {
  asObject,
  jsonError,
  mapRouteError,
  readJsonBody,
  requireAuthenticatedRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { resolvePlaceUrl } from "@/server/place-service";
import { requireTripRole } from "@/server/trip-access";

import { readTripIdParam, type TripParams } from "../../_utils";

export async function POST(request: Request, { params }: TripParams) {
  const auth = await requireAuthenticatedRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const tripId = await readTripIdParam(params);
  if (tripId instanceof Response) {
    return tripId;
  }

  try {
    await requireTripRole(tripId, auth.user.id, "owner");
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = asObject(parsedBody.body);
  const googleMapsUrl = stringOrNull(body.google_maps_url);
  if (!googleMapsUrl) {
    return jsonError("Google Maps URL is required.", 400);
  }

  try {
    const resolved = await resolvePlaceUrl(googleMapsUrl);
    if (resolved.latitude === null || resolved.longitude === null) {
      return jsonError(
        "Could not resolve coordinates from the Google Maps URL.",
        400,
      );
    }

    return withRefreshedSession(
      NextResponse.json({
        google_maps_url: resolved.google_maps_url,
        name: resolved.name,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      }),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
