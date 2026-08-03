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
  requireUserOrGuestRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { sanitizeLinks } from "@/lib/safe-links";
import { recordGuestEvent } from "@/server/guest-events";
import { resolvePlaceImage } from "@/server/place-image-resolution";
import {
  createPlaceForRequest,
  removeAllPlacesForRequest,
  resolvePlaceUrl,
} from "@/server/place-service";
import { requireTripRole } from "@/server/trip-access";

import { readTripIdParam, type TripParams } from "../_utils";

export async function POST(request: Request, { params }: TripParams) {
  const auth = await requireUserOrGuestRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const tripId = await readTripIdParam(params);
  if (tripId instanceof Response) {
    return tripId;
  }

  try {
    await requireTripRole(tripId, auth.principal.principalId, "owner");
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

    const placeId = coordinates ? stringOrNull(body.google_place_id) : null;
    // Google's canonical name, which the reuse lookup later serves to other
    // accounts that pick the same place id. It arrives from the client like
    // every other field here, so it is only stored when it is tied to a place
    // id and within a plausible length; anything else is dropped rather than
    // rejected, since it is an optimisation and never required to save.
    const googlePlaceName = placeId
      ? clampedName(stringOrNull(body.google_place_name))
      : null;
    // The photo data URL was fetched (and billed) once at preview time; here it
    // is only validated and stored, never re-fetched from Google.
    const image = await resolvePlaceImage({
      userId: auth.principal.principalId,
      photoDataUrl: stringOrNull(body.photo_data_url),
      photoAttribution: stringOrNull(body.photo_attribution),
      placeId,
    });

    const snapshot = NextResponse.json(
      await createPlaceForRequest(tripId, auth.principal.principalId, {
        name,
        address: stringOrNull(body.address),
        notes: stringOrNull(body.notes),
        google_maps_url: resolved.google_maps_url,
        google_place_id: placeId,
        google_place_name: googlePlaceName,
        google_place_token: null,
        google_internal_ids: null,
        source_list_url: null,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        links: sanitizeLinks(body.links),
        image_url: image.image_url,
        image_credit: image.image_credit,
        visit_date: visitDate,
        visit_time: visitTime,
      }),
    );

    if (auth.principal.kind === "guest") {
      void recordGuestEvent(auth.principal.guestId, "place_added", {
        trip_id: tripId,
      });
    }

    return withRefreshedSession(snapshot, auth.refreshedSession);
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE(request: Request, { params }: TripParams) {
  const auth = await requireUserOrGuestRequest(request);
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
        await removeAllPlacesForRequest(tripId, auth.principal.principalId),
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

// Longest Google display name we will store. Real place names sit far under
// this; anything longer is not a name we want to serve back to other accounts.
const MAX_GOOGLE_PLACE_NAME_LENGTH = 200;

function clampedName(value: string | null): string | null {
  return value && value.length <= MAX_GOOGLE_PLACE_NAME_LENGTH ? value : null;
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
