import { NextResponse } from "next/server";

import {
  mapRouteError,
  readJsonBody,
  requireUserOrGuestRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { saveAiPlanningPreferencesForRequest } from "@/server/ai-planning-service";

import { readTripIdParam, type TripParams } from "../../_utils";

export async function PUT(request: Request, { params }: TripParams) {
  const auth = await requireUserOrGuestRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const tripId = await readTripIdParam(params);
  if (tripId instanceof Response) {
    return tripId;
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    return withRefreshedSession(
      NextResponse.json(
        await saveAiPlanningPreferencesForRequest(
          tripId,
          auth.principal.principalId,
          parsedBody.body,
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
