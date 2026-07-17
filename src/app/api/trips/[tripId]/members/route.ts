import { NextResponse } from "next/server";

import {
  asObject,
  jsonError,
  mapRouteError,
  readJsonBody,
  readTripId,
  requireAuthenticatedRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import type { TripRole } from "@/lib/types";
import { addTripMemberByEmail } from "@/server/trip-members";
import { requireTripRole } from "@/server/trip-access";

const TRIP_ROLES: TripRole[] = ["owner", "viewer"];

export async function POST(
  request: Request,
  context: { params: Promise<{ tripId: string }> },
) {
  const auth = await requireAuthenticatedRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const tripId = await readTripId(context.params);
  if (tripId instanceof NextResponse) {
    return tripId;
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = asObject(parsedBody.body);
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  if (!isValidEmail(email)) {
    return jsonError("A valid email is required.", 400);
  }

  const role = body.role;
  if (!isTripRole(role)) {
    return jsonError("Member role must be owner or viewer.", 400);
  }

  try {
    await requireTripRole(tripId, auth.user.id, "owner");
    return withRefreshedSession(
      NextResponse.json(
        { members: await addTripMemberByEmail(tripId, email, role) },
        { status: 201 },
      ),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}

function isTripRole(value: unknown): value is TripRole {
  return typeof value === "string" && TRIP_ROLES.includes(value as TripRole);
}
