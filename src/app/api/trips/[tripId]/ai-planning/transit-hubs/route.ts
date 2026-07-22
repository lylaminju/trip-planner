import { NextResponse } from "next/server";

import {
  mapRouteError,
  requireAuthenticatedRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { prepareDestinationTransitHubsForRequest } from "@/server/ai-planning-service";

import { readTripIdParam, type TripParams } from "../../_utils";

export async function POST(request: Request, { params }: TripParams) {
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
      NextResponse.json({
        transitHubs: await prepareDestinationTransitHubsForRequest(
          tripId,
          auth.user.id,
        ),
      }),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}
