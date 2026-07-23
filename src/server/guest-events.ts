import { getSupabaseClient } from "./supabase";

// Guest analytics events; see the guest mode policy doc. Raw IPs are never
// stored here.
export const GUEST_EVENT_NAMES = [
  "trip_created",
  "sample_cloned",
  "place_added",
  "generation_run",
  "limit_hit",
  "upsell_shown",
  "upsell_clicked",
] as const;

export type GuestEventName = (typeof GUEST_EVENT_NAMES)[number];

export function isGuestEventName(value: unknown): value is GuestEventName {
  return (
    typeof value === "string" &&
    (GUEST_EVENT_NAMES as readonly string[]).includes(value)
  );
}

// Analytics must never break a guest flow: callers fire-and-forget, and any
// insert failure is swallowed.
export async function recordGuestEvent(
  guestId: string,
  eventName: GuestEventName,
  metadata: Record<string, unknown> | null = null,
): Promise<void> {
  try {
    await getSupabaseClient()
      .from("guest_events")
      .insert({ guest_id: guestId, event_name: eventName, metadata });
  } catch {
    // Ignored: analytics only.
  }
}
