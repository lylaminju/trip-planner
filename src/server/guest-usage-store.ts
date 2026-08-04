import { getSupabaseClient } from "./supabase";
import { throwSupabaseError } from "./supabase-errors";

// Metered call kinds recorded per guest in guest_api_usage.
export const GUEST_USAGE_KIND = {
  AI_GENERATION: "ai_generation",
  GOOGLE_ROUTES: "google_routes",
} as const;

export type GuestUsageKind =
  (typeof GUEST_USAGE_KIND)[keyof typeof GUEST_USAGE_KIND];

export async function countGuestCallsToday(
  guestId: string,
  kind: GuestUsageKind,
): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("guest_api_usage")
    .select("*", { count: "exact", head: true })
    .eq("guest_id", guestId)
    .eq("kind", kind)
    .gte("called_at", todayStartIso());

  if (error) throwSupabaseError(error);
  return count ?? 0;
}

export async function countAllGuestCallsToday(
  kind: GuestUsageKind,
): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("guest_api_usage")
    .select("*", { count: "exact", head: true })
    .eq("kind", kind)
    .gte("called_at", todayStartIso());

  if (error) throwSupabaseError(error);
  return count ?? 0;
}

// ip_hash is recorded for later abuse analysis but never enforced; see the
// guest mode policy doc.
export async function recordGuestCall(
  guestId: string,
  kind: GuestUsageKind,
  ipHash: string | null,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("guest_api_usage")
    .insert({ guest_id: guestId, kind, ip_hash: ipHash });

  if (error) throwSupabaseError(error);
}

function todayStartIso(): string {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  return todayStart.toISOString();
}
