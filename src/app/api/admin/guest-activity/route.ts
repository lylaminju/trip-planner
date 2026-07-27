import { NextResponse } from "next/server";

import { jsonError, requireAuthenticatedRequest } from "@/app/api/_utils";
import { getGuestActivityStats } from "@/server/supabase-admin-guest-activity-store";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedRequest(request);
  if (!auth.ok) return auth.response;

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || auth.user.email !== adminEmail) {
    return jsonError("Forbidden.", 403);
  }

  try {
    const stats = await getGuestActivityStats();
    return NextResponse.json(stats);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load guest activity.",
      500,
    );
  }
}
