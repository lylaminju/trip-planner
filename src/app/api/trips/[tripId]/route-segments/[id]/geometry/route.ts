import { NextResponse } from "next/server";

import {
  jsonError,
  mapRouteError,
  requireAuthenticatedRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { GoogleRoutesRateLimitError } from "@/server/errors";
import { getRouteGeometry } from "@/server/route-geometry-service";
import {
  countUserGoogleRoutesCallsToday,
  GOOGLE_ROUTES_DAILY_LIMIT,
} from "@/server/supabase-google-routes-usage-store";
import { requireTripRole } from "@/server/trip-access";

import { readEntityParams, type TripEntityParams } from "../../../_utils";

export async function GET(request: Request, { params }: TripEntityParams) {
  const auth = await requireAuthenticatedRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const parsedParams = await readEntityParams(params, "segment");
  if (parsedParams instanceof Response) {
    return parsedParams;
  }

  if (!Number.isInteger(parsedParams.id)) {
    return jsonError("Invalid segment id.", 400);
  }

  try {
    await requireTripRole(parsedParams.tripId, auth.user.id, "viewer");

    const googleRoutesCount = await countUserGoogleRoutesCallsToday(auth.user.id);
    if (googleRoutesCount >= GOOGLE_ROUTES_DAILY_LIMIT) {
      throw new GoogleRoutesRateLimitError(
        "Daily Google Routes limit reached. Please try again tomorrow.",
      );
    }

    return withRefreshedSession(
      NextResponse.json(
        await getRouteGeometry(parsedParams.tripId, parsedParams.id, auth.user.id),
      ),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}
