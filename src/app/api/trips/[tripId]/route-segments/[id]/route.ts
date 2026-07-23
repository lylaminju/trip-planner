import { NextResponse } from "next/server";

import {
  asObject,
  jsonError,
  mapRouteError,
  readJsonBody,
  requireUserOrGuestRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import type { TravelMode } from "@/lib/types";
import { setRouteSegmentModeForRequest } from "@/server/place-service";

import { readEntityParams, type TripEntityParams } from "../../_utils";

const MODES = new Set<TravelMode>([
  "walking",
  "transit",
  "bicycling",
  "driving",
]);

export async function PATCH(request: Request, { params }: TripEntityParams) {
  const auth = await requireUserOrGuestRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const parsedParams = await readEntityParams(params, "segment");
  if (parsedParams instanceof Response) {
    return parsedParams;
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = asObject(parsedBody.body);
  if (!MODES.has(body.mode as TravelMode)) {
    return jsonError("Invalid travel mode.", 400);
  }

  try {
    return withRefreshedSession(
      NextResponse.json(
        await setRouteSegmentModeForRequest(
          parsedParams.tripId,
          auth.principal.principalId,
          parsedParams.id,
          body.mode as TravelMode,
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
