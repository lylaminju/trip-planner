import { NextResponse } from "next/server";

import {
  asObject,
  isValidLatitude,
  isValidLongitude,
  jsonError,
  mapRouteError,
  readJsonBody,
  requireAuthenticatedRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import type { AutocompleteLocationBias } from "@/server/google-places";
import { searchDestinations } from "@/server/google-places-search-service";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = asObject(parsedBody.body);
  const query = stringOrNull(body.query);
  const sessionToken = stringOrNull(body.session_token);
  if (!query || !sessionToken) {
    return jsonError("Search query and session token are required.", 400);
  }

  const locationBias = readLocationBias(body);
  if (locationBias instanceof NextResponse) {
    return locationBias;
  }

  try {
    const suggestions = await searchDestinations(
      auth.user.id,
      query,
      sessionToken,
      locationBias,
    );

    return withRefreshedSession(
      NextResponse.json({ suggestions }),
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

// Bias is optional, but if either coordinate is present both must be valid.
function readLocationBias(
  body: Record<string, unknown>,
): AutocompleteLocationBias | NextResponse | null {
  const latitude = body.bias_latitude;
  const longitude = body.bias_longitude;
  if (latitude === undefined && longitude === undefined) {
    return null;
  }

  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    return jsonError("Location bias coordinates are invalid.", 400);
  }

  return { latitude, longitude };
}
