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
  createTripForRequest,
  listTripsForRequest,
  type TripCreateInput,
} from "@/server/trip-service";
import { findDestinationOption } from "@/lib/destination-options";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    return withRefreshedSession(
      NextResponse.json({
        trips: await listTripsForRequest(auth.user.id),
      }),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const parsedInput = parseTripCreateInput(parsedBody.body);
  if (parsedInput instanceof Response) {
    return parsedInput;
  }

  try {
    return withRefreshedSession(
      NextResponse.json(
        { trip: await createTripForRequest(auth.user.id, parsedInput) },
        { status: 201 },
      ),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}

function parseTripCreateInput(
  value: unknown,
): TripCreateInput | NextResponse {
  const body = asObject(value);
  const name = stringOrNull(body.name);
  if (!name) {
    return jsonError("Trip name is required.", 400);
  }

  const destination = stringOrNull(body.destination);
  if (!destination) {
    return jsonError("Trip destination is required.", 400);
  }

  const startDate = nullableDate(body.start_date, "Trip start date");
  if (startDate instanceof Response) {
    return startDate;
  }

  const endDate = nullableDate(body.end_date, "Trip end date");
  if (endDate instanceof Response) {
    return endDate;
  }

  const destinationSlug = nullableDestinationSlug(body.destination_slug);
  if (destinationSlug instanceof Response) {
    return destinationSlug;
  }

  const latitude = nullableCoordinate(
    body.destination_latitude,
    MAX_LATITUDE,
    "Trip destination latitude",
  );
  if (latitude instanceof Response) {
    return latitude;
  }

  const longitude = nullableCoordinate(
    body.destination_longitude,
    MAX_LONGITUDE,
    "Trip destination longitude",
  );
  if (longitude instanceof Response) {
    return longitude;
  }

  if (startDate && endDate && startDate > endDate) {
    return jsonError(
      "Trip start date must be before or equal to end date.",
      400,
    );
  }

  return {
    name,
    destination,
    destination_slug: destinationSlug,
    destination_latitude: latitude,
    destination_longitude: longitude,
    destination_photo_data: nullablePhotoData(body.destination_photo_data),
    destination_photo_attribution: nullablePhotoAttribution(
      body.destination_photo_attribution,
    ),
    start_date: startDate,
    end_date: endDate,
  };
}

const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;
const MAX_PHOTO_ATTRIBUTION_LENGTH = 200;
// Generous ceiling for a base64 cover image (~5MB decoded) so oversized bodies
// are rejected early; the image bytes are validated again before storage.
const MAX_PHOTO_DATA_LENGTH = 8_000_000;

// Photos are an optional enhancement, so malformed values fail closed to null
// rather than rejecting the trip. The bytes are validated again in the photo
// service before storage.
function nullablePhotoData(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  if (
    value.length > MAX_PHOTO_DATA_LENGTH ||
    !value.startsWith("data:image/")
  ) {
    return null;
  }
  return value;
}

function nullablePhotoAttribution(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_PHOTO_ATTRIBUTION_LENGTH) : null;
}

function nullableCoordinate(
  value: unknown,
  maxAbsolute: number,
  label: string,
): number | NextResponse | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) > maxAbsolute
  ) {
    return jsonError(`${label} is invalid.`, 400);
  }

  return value;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableDestinationSlug(
  value: unknown,
): string | NextResponse | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return jsonError("Trip destination slug is invalid.", 400);
  }

  const slug = value.trim();
  return findDestinationOption(slug)?.slug === slug
    ? slug
    : jsonError("Trip destination slug is invalid.", 400);
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
