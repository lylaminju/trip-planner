import { NextResponse } from "next/server";

import {
  asObject,
  isValid24HourTime,
  isValidIsoDate,
  isValidLatitude,
  isValidLongitude,
  jsonError,
  mapRouteError,
  readJsonBody,
  requireAuthenticatedRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { resolvePlaceImage } from "@/server/place-image-resolution";
import {
  createPlaceForRequest,
  removeAllPlacesForRequest,
  resolvePlaceUrl,
} from "@/server/place-service";
import { requireTripRole } from "@/server/trip-access";

import { readTripIdParam, type TripParams } from "../_utils";

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

  const visitDate = dateOrNull(body.visit_date);
  if (visitDate instanceof Response) {
    return visitDate;
  }

  const visitTime = timeOrNull(body.visit_time);
  if (visitTime instanceof Response) {
    return visitTime;
  }

  try {
    const coordinates = readClientCoordinates(body);
    if (coordinates instanceof NextResponse) {
      return coordinates;
    }

    // A search-selected place already carries verified coordinates from Place
    // Details, so the URL-resolution step is skipped entirely.
    const resolved = coordinates
      ? { google_maps_url: googleMapsUrl, name: null, ...coordinates }
      : await resolvePlaceUrl(googleMapsUrl);
    const name = stringOrNull(body.name) ?? resolved.name;
    if (!name) {
      return jsonError(
        "Name is required when it cannot be resolved from the URL.",
        400,
      );
    }
    if (resolved.latitude === null || resolved.longitude === null) {
      return jsonError(
        "Could not resolve coordinates from the Google Maps URL.",
        400,
      );
    }

    const placeId = coordinates ? stringOrNull(body.place_id) : null;
    // The photo data URL was fetched (and billed) once at preview time; here it
    // is only validated and stored, never re-fetched from Google.
    const image = await resolvePlaceImage({
      userId: auth.user.id,
      photoDataUrl: stringOrNull(body.photo_data_url),
      photoAttribution: stringOrNull(body.photo_attribution),
      placeId,
    });

    return withRefreshedSession(
      NextResponse.json(
        await createPlaceForRequest(tripId, auth.user.id, {
          name,
          address: stringOrNull(body.address),
          notes: stringOrNull(body.notes),
          google_maps_url: resolved.google_maps_url,
          place_id: placeId,
          google_place_token: null,
          google_internal_ids: null,
          source_list_url: null,
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          links: stringArray(body.links),
          image_url: image.image_url,
          image_credit: image.image_credit,
          visit_date: visitDate,
          visit_time: visitTime,
        }),
      ),
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
    return withRefreshedSession(
      NextResponse.json(
        await removeAllPlacesForRequest(tripId, auth.user.id),
      ),
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

// Coordinates are optional (URL-only bodies resolve them server-side), but if
// either is present both must be valid numbers in range.
function readClientCoordinates(
  body: Record<string, unknown>,
): { latitude: number; longitude: number } | NextResponse | null {
  const latitude = body.latitude;
  const longitude = body.longitude;
  if (latitude === undefined && longitude === undefined) {
    return null;
  }

  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    return jsonError("Place coordinates are invalid.", 400);
  }

  return { latitude, longitude };
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function dateOrNull(value: unknown): string | NextResponse | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return jsonError("Visit date must be YYYY-MM-DD.", 400);
  }

  const text = stringOrNull(value);
  return text && isValidIsoDate(text)
    ? text
    : jsonError("Visit date must be YYYY-MM-DD.", 400);
}

function timeOrNull(value: unknown): string | NextResponse | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return jsonError("Visit time must be HH:MM.", 400);
  }

  const text = stringOrNull(value);
  return text && isValid24HourTime(text)
    ? text
    : jsonError("Visit time must be HH:MM.", 400);
}
