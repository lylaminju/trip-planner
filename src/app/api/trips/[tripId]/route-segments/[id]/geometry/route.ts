import { NextResponse } from "next/server";

import {
  jsonError,
  mapRouteError,
  requireUserOrGuestRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { hashedRequestIp } from "@/server/request-ip";
import { getRouteGeometry } from "@/server/route-geometry-service";
import { requireTripRole } from "@/server/trip-access";

import { readEntityParams, type TripEntityParams } from "../../../_utils";

export async function GET(request: Request, { params }: TripEntityParams) {
  const auth = await requireUserOrGuestRequest(request);
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
    await requireTripRole(
      parsedParams.tripId,
      auth.principal.principalId,
      "viewer",
    );

    // Quota is asserted inside the geometry service, only on a cache miss, so
    // cached geometry (including cloned sample trips) stays quota-free.
    return withRefreshedSession(
      NextResponse.json(
        await getRouteGeometry(
          parsedParams.tripId,
          parsedParams.id,
          auth.principal.principalId,
          hashedRequestIp(request),
        ),
      ),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}
