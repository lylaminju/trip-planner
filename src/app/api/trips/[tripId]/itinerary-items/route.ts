import { NextResponse } from "next/server";

import {
  mapRouteError,
  requireAuthenticatedRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { removeAllItineraryItemsForRequest } from "@/server/place-service";

import { readTripIdParam, type TripParams } from "../_utils";

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
        await removeAllItineraryItemsForRequest(tripId, auth.user.id),
      ),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}
