import { NextResponse } from "next/server";

import {
  asObject,
  isValidIsoDate,
  jsonError,
  mapRouteError,
  readJsonBody,
} from "@/app/api/_utils";
import {
  guestSessionSecret,
  mintGuestId,
  readGuestIdFromCookieHeader,
  setGuestCookie,
} from "@/server/guest-session";
import { recordGuestEvent } from "@/server/guest-events";
import {
  cloneSampleTripForGuest,
  createGuestTrip,
} from "@/server/guest-trip-service";
import { deleteExpiredGuestTrips } from "@/server/trip-service";

const GUEST_TRIP_MODES = ["new", "sample"] as const;
const MAX_TRIP_NAME_LENGTH = 120;

// Mints the guest cookie and creates a guest-owned ephemeral trip. This is the
// only way to obtain a guest session, so every guest API request carries a
// cookie signed here.
export async function POST(request: Request) {
  const secret = guestSessionSecret();
  if (!secret) {
    return jsonError("Guest mode is not available.", 503);
  }

  // Same-origin browsers only; blocks trivial cross-site drive-by creation.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return jsonError("Invalid request origin.", 403);
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = asObject(parsedBody.body);

  const mode = body.mode;
  if (typeof mode !== "string" || !GUEST_TRIP_MODES.includes(mode as never)) {
    return jsonError("Invalid guest trip mode.", 400);
  }

  const guestId =
    readGuestIdFromCookieHeader(request.headers.get("cookie"), secret) ??
    mintGuestId();

  // Opportunistic cleanup keeps expired demo trips from accumulating without
  // needing a scheduler; failures never block trip creation.
  deleteExpiredGuestTrips().catch(() => {});

  try {
    const created =
      mode === "sample"
        ? await cloneSampleTripForGuest(guestId)
        : await createGuestTrip(guestId, readNewTripInput(body));

    void recordGuestEvent(
      guestId,
      mode === "sample" ? "sample_cloned" : "trip_created",
      { trip_id: created.tripId },
    );

    return setGuestCookie(
      NextResponse.json({ tripId: created.tripId }, { status: 201 }),
      guestId,
      secret,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}

function readNewTripInput(body: Record<string, unknown>): {
  name: string;
  destination_slug: string;
  start_date: string | null;
  end_date: string | null;
} {
  const destinationSlug =
    typeof body.destination_slug === "string" ? body.destination_slug : "";
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, MAX_TRIP_NAME_LENGTH)
      : "My trip";

  return {
    name,
    destination_slug: destinationSlug,
    start_date: readIsoDate(body.start_date),
    end_date: readIsoDate(body.end_date),
  };
}

function readIsoDate(value: unknown): string | null {
  return typeof value === "string" && isValidIsoDate(value) ? value : null;
}
