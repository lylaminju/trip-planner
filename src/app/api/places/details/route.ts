import { NextResponse } from "next/server";

import {
  asObject,
  jsonError,
  mapRouteError,
  readJsonBody,
  requireAuthenticatedRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { getDestinationDetails } from "@/server/google-places-search-service";

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
  const placeId = stringOrNull(body.place_id);
  const sessionToken = stringOrNull(body.session_token);
  if (!placeId || !sessionToken) {
    return jsonError("Place id and session token are required.", 400);
  }

  try {
    const place = await getDestinationDetails(
      auth.user.id,
      placeId,
      sessionToken,
    );

    return withRefreshedSession(
      NextResponse.json({ place }),
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
