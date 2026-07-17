import { NextResponse } from "next/server";

import {
  jsonError,
  mapRouteError,
  requireAuthenticatedRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { removeTripMember } from "@/server/trip-members";
import { requireTripRole } from "@/server/trip-access";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ tripId: string; userId: string }> },
) {
  const auth = await requireAuthenticatedRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { tripId: rawTripId, userId } = await context.params;
  const tripId = Number(rawTripId);
  if (!Number.isInteger(tripId)) {
    return jsonError("Invalid trip id.", 400);
  }

  if (!userId.trim()) {
    return jsonError("Invalid member id.", 400);
  }

  if (userId === auth.user.id) {
    return jsonError("You cannot remove yourself from a trip.", 400);
  }

  try {
    await requireTripRole(tripId, auth.user.id, "owner");
    return withRefreshedSession(
      NextResponse.json({ members: await removeTripMember(tripId, userId) }),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}
