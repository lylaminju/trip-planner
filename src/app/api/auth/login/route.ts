import { NextResponse } from "next/server";

import { asObject, jsonError, readJsonBody } from "@/app/api/_utils";
import { setAuthCookies, signInWithPassword } from "@/server/auth-session";

export async function POST(request: Request) {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = asObject(parsedBody.body);
  const email = stringOrNull(body.email);
  const password = stringOrNull(body.password);

  if (!email || !password) {
    return jsonError("Email and password are required.", 400);
  }

  try {
    const session = await signInWithPassword(email, password);
    return setAuthCookies(NextResponse.json({ ok: true }), session);
  } catch (error) {
    if (error instanceof Error) {
      return jsonError(error.message, 401);
    }

    throw error;
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
