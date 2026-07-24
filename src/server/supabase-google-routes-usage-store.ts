import { GoogleRoutesRateLimitError } from "./errors";
import { recordGuestEvent } from "./guest-events";
import {
  countAllGuestCallsToday,
  countGuestCallsToday,
  GUEST_GOOGLE_ROUTES_DAILY_LIMIT,
  GUEST_GOOGLE_ROUTES_GLOBAL_DAILY_CAP,
  GUEST_USAGE_KIND,
  recordGuestCall,
} from "./guest-usage-store";
import { guestIdFromPrincipalId } from "./principal";
import { getSupabaseClient } from "./supabase";

export const GOOGLE_ROUTES_DAILY_LIMIT = 200;

export async function countUserGoogleRoutesCallsToday(
  userId: string,
): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count, error } = await getSupabaseClient()
    .from("google_routes_api_calls")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("called_at", todayStart.toISOString());

  if (error) throwSupabaseError(error);
  return count ?? 0;
}

// Throws when the principal has no Google Routes budget left today. Guests are
// bounded twice: per guest cookie, and by the demo-wide cap that bounds
// worst-case spend regardless of how many cookies an abuser mints.
export async function assertGoogleRoutesQuota(
  principalId: string,
): Promise<void> {
  const guestId = guestIdFromPrincipalId(principalId);

  if (guestId === null) {
    const count = await countUserGoogleRoutesCallsToday(principalId);
    if (count >= GOOGLE_ROUTES_DAILY_LIMIT) {
      throw new GoogleRoutesRateLimitError(
        "Daily Google Routes limit reached. Please try again tomorrow.",
      );
    }
    return;
  }

  const guestCount = await countGuestCallsToday(
    guestId,
    GUEST_USAGE_KIND.GOOGLE_ROUTES,
  );
  if (guestCount >= GUEST_GOOGLE_ROUTES_DAILY_LIMIT) {
    void recordGuestEvent(guestId, "limit_hit", {
      kind: GUEST_USAGE_KIND.GOOGLE_ROUTES,
      scope: "guest",
    });
    throw new GoogleRoutesRateLimitError(
      "Daily route lookup limit reached for this guest session. Sign in for a higher limit.",
    );
  }

  const globalCount = await countAllGuestCallsToday(
    GUEST_USAGE_KIND.GOOGLE_ROUTES,
  );
  if (globalCount >= GUEST_GOOGLE_ROUTES_GLOBAL_DAILY_CAP) {
    void recordGuestEvent(guestId, "limit_hit", {
      kind: GUEST_USAGE_KIND.GOOGLE_ROUTES,
      scope: "global",
    });
    throw new GoogleRoutesRateLimitError(
      "The guest demo's route budget is used up for today. Sign in for full access.",
    );
  }
}

export async function recordGoogleRoutesCall(
  principalId: string,
  ipHash: string | null = null,
): Promise<void> {
  const guestId = guestIdFromPrincipalId(principalId);
  if (guestId !== null) {
    await recordGuestCall(guestId, GUEST_USAGE_KIND.GOOGLE_ROUTES, ipHash);
    return;
  }

  const { error } = await getSupabaseClient()
    .from("google_routes_api_calls")
    .insert({ user_id: principalId });

  if (error) throwSupabaseError(error);
}

function throwSupabaseError(error: { message: string }): never {
  throw new Error(`Supabase query failed: ${error.message}`);
}
