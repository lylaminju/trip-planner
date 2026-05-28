import { NextResponse } from "next/server";

import {
  jsonError,
  mapRouteError,
  requireAuthenticatedRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { getRouteGeometry } from "@/server/route-geometry-service";
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
    return withRefreshedSession(
      NextResponse.json(
        await getRouteGeometry(parsedParams.tripId, parsedParams.id),
      ),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}
