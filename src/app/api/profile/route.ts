import { NextResponse } from "next/server";

import {
  asObject,
  jsonError,
  readJsonBody,
  requireAuthenticatedRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { updateUserProfile } from "@/server/auth-session";
import {
  AI_DIETARY_NOTES_MAX_LENGTH,
  isAiDietaryTag,
} from "@/lib/ai-planning-preferences";
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

  // Absent dietary fields mean "keep empty", so an older client that never
  // sends them still saves cleanly; present-but-malformed values fail closed.
  const rawDietaryTags = body.dietaryTags ?? [];
  if (
    !Array.isArray(rawDietaryTags) ||
    rawDietaryTags.some(
      (tag) => typeof tag !== "string" || !isAiDietaryTag(tag),
    )
  ) {
    return jsonError("Invalid dietary preference.", 400);
  }
  const dietaryTags = Array.from(new Set(rawDietaryTags as string[]));

  const rawDietaryNotes = body.dietaryNotes ?? null;
  if (rawDietaryNotes !== null && typeof rawDietaryNotes !== "string") {
    return jsonError("Dietary notes must be text.", 400);
  }
  const trimmedDietaryNotes = rawDietaryNotes?.trim() ?? "";
  if (trimmedDietaryNotes.length > AI_DIETARY_NOTES_MAX_LENGTH) {
    return jsonError(
      `Dietary notes must be ${AI_DIETARY_NOTES_MAX_LENGTH} characters or fewer.`,
      400,
    );
  }

  const saved = await updateUserProfile(auth.user.id, {
    username,
    profileColor,
    dietaryTags,
    dietaryNotes: trimmedDietaryNotes === "" ? null : trimmedDietaryNotes,
  });

  return withRefreshedSession(
    NextResponse.json({ profile: saved }),
    auth.refreshedSession,
  );
}
