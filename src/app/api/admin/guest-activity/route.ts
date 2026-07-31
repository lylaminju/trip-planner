import { NextResponse } from "next/server";

import {
  jsonError,
  mapRouteError,
  requireAuthenticatedRequest,
} from "@/app/api/_utils";
import { resolveTimeZone } from "@/lib/daily-counts";
import { getGuestActivityStats } from "@/server/supabase-admin-guest-activity-store";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedRequest(request);
  if (!auth.ok) return auth.response;

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || auth.user.email !== adminEmail) {
    return jsonError("Forbidden.", 403);
  }

  const timeZone = resolveTimeZone(new URL(request.url).searchParams.get("tz"));

  try {
    const stats = await getGuestActivityStats(timeZone);
    return NextResponse.json(stats);
  } catch (error) {
    const response = mapRouteError(error, request);
    if (response) return response;
    throw error;
  }
}
