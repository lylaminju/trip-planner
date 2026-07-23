import type { GuestEventName } from "@/server/guest-events";

export type GuestTripRequest =
  | { mode: "sample" }
  | {
      mode: "new";
      name: string;
      destination_slug: string;
      start_date: string | null;
      end_date: string | null;
    };

export async function createGuestTrip(
  input: GuestTripRequest,
): Promise<{ tripId: number }> {
  const response = await fetch("/api/guest/trips", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = (await response.json().catch(() => ({}))) as {
    tripId?: number;
    error?: string;
  };
  if (!response.ok || typeof data.tripId !== "number") {
    throw new Error(data.error ?? "Could not start a guest trip.");
  }

  return { tripId: data.tripId };
}

// Fire-and-forget analytics beacon; failures are ignored.
export function sendGuestEvent(eventName: GuestEventName): void {
  void fetch("/api/guest/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event_name: eventName }),
    keepalive: true,
  }).catch(() => {});
}
