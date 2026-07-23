import { NextResponse } from "next/server";

import { asObject, jsonError, readJsonBody } from "@/app/api/_utils";
import { isGuestEventName, recordGuestEvent } from "@/server/guest-events";
import {
  guestSessionSecret,
  readGuestIdFromCookieHeader,
} from "@/server/guest-session";

// Client-side analytics beacons (upsell impressions and clicks). Server-side
// guest actions are recorded directly by their routes, not through here.
export async function POST(request: Request) {
  const secret = guestSessionSecret();
  const guestId = secret
    ? readGuestIdFromCookieHeader(request.headers.get("cookie"), secret)
    : null;
  if (!guestId) {
    return jsonError("Authentication required.", 401);
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const eventName = asObject(parsedBody.body).event_name;
  if (!isGuestEventName(eventName)) {
    return jsonError("Unknown event.", 400);
  }

  await recordGuestEvent(guestId, eventName);
  return NextResponse.json({ ok: true });
}
