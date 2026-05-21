import { NextResponse } from "next/server";

import { clearAuthCookies } from "@/server/auth-session";

export async function POST() {
  return clearAuthCookies(NextResponse.json({ ok: true }));
}
