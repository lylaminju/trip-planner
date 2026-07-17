import { NextResponse } from "next/server";

import {
  jsonError,
  mapRouteError,
  requireAuthenticatedRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { lookupProfileByEmail } from "@/server/profile-lookup";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const rawEmail = new URL(request.url).searchParams.get("email") ?? "";
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return jsonError("A valid email is required.", 400);
  }

  try {
    return withRefreshedSession(
      NextResponse.json(await lookupProfileByEmail(email)),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}
