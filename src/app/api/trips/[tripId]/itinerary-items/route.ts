import { NextResponse } from "next/server";

import {
  mapRouteError,
  requireUserOrGuestRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { removeAllItineraryItemsForRequest } from "@/server/place-service";

import { readTripIdParam, type TripParams } from "../_utils";

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
        await removeAllItineraryItemsForRequest(tripId, auth.principal.principalId),
      ),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}
