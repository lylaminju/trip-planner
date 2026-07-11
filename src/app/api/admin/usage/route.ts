import { NextResponse } from "next/server";

import { jsonError, requireAuthenticatedRequest } from "@/app/api/_utils";
import { getAllUsersUsageStats } from "@/server/supabase-admin-usage-store";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedRequest(request);
  if (!auth.ok) return auth.response;

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || auth.user.email !== adminEmail) {
    return jsonError("Forbidden.", 403);
  }

  try {
    const stats = await getAllUsersUsageStats();
    return NextResponse.json(stats);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load usage stats.", 500);
  }
}
