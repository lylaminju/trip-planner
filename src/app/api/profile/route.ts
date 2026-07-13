import { NextResponse } from "next/server";

import {
  asObject,
  jsonError,
  readJsonBody,
  requireAuthenticatedRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { updateUserProfile } from "@/server/auth-session";
import { isValidProfileColor } from "@/lib/profile-colors";

const MAX_USERNAME_LENGTH = 40;

export async function PATCH(request: Request) {
  const auth = await requireAuthenticatedRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = asObject(parsedBody.body);
  const username =
    typeof body.username === "string" ? body.username.trim() : "";
  const profileColor = body.profileColor;

  if (!username) {
    return jsonError("Username is required.", 400);
  }

  if (username.length > MAX_USERNAME_LENGTH) {
    return jsonError(
      `Username must be ${MAX_USERNAME_LENGTH} characters or fewer.`,
      400,
    );
  }

  if (!isValidProfileColor(profileColor)) {
    return jsonError("Invalid profile color.", 400);
  }

  const saved = await updateUserProfile(auth.user.id, {
    username,
    profileColor,
  });

  return withRefreshedSession(
    NextResponse.json({ profile: saved }),
    auth.refreshedSession,
  );
}
