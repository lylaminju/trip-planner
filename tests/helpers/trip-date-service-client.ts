import { vi } from "vitest";

import type { ScheduledVisit, TripDateRange } from "@/lib/trip-date-shift";

export type Recorded = {
  tripUpdates: Record<string, unknown>[];
  rpcCalls: Array<{ name: string; args: Record<string, unknown> }>;
};

/**
 * Drives updateTripForRequest against a fake Supabase so the real store and
 * shift logic run, and records only what reaches the database.
 */
export async function withDateShiftClient(
  recorded: Recorded,
  run: (
    updateTripForRequest: typeof import("@/server/trip-service").updateTripForRequest,
  ) => Promise<void>,
  options: {
    visits?: ScheduledVisit[];
    dates?: TripDateRange;
    rpcError?: string;
  } = {},
) {
  vi.resetModules();
  vi.doMock("@/server/trip-access", () => ({
    requireTripRole: vi.fn().mockResolvedValue({
      trip_id: 1,
      user_id: "user-1",
      role: "owner",
      created_at: "2026-01-01T00:00:00.000Z",
    }),
  }));
  vi.doMock("@/server/supabase", () => ({
    getSupabaseClient: () => dateShiftClient(recorded, options),
  }));
  vi.doMock("@/server/trip-members", () => ({
    listTripMembers: vi.fn().mockResolvedValue(new Map()),
  }));

  try {
    const { updateTripForRequest } = await import("@/server/trip-service");
    await run(updateTripForRequest);
  } finally {
    vi.doUnmock("@/server/trip-access");
    vi.doUnmock("@/server/supabase");
    vi.doUnmock("@/server/trip-members");
    vi.restoreAllMocks();
    vi.resetModules();
  }
}

function dateShiftClient(
  recorded: Recorded,
  options: {
    visits?: ScheduledVisit[];
    dates?: TripDateRange;
    rpcError?: string;
  },
) {
  const storedTrip = {
    id: 1,
    created_by: "user-1",
    name: "Iceland round tour",
    destination: "Iceland",
    destination_slug: "iceland",
    start_date: "2027-07-12",
    end_date: "2027-07-18",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...options.dates,
  };
  const visits = options.visits ?? [
    { id: 1, visit_date: "2027-07-12" },
    { id: 2, visit_date: "2027-07-18" },
  ];

  return {
    from(table: string) {
      if (table === "trips") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                async single() {
                  return { data: storedTrip, error: null };
                },
              }),
            }),
          }),
          update: (input: Record<string, unknown>) => ({
            async eq() {
              recorded.tripUpdates.push(input);
              return { error: null };
            },
          }),
        };
      }

      // Visit dates are only ever written through the realign RPC; a direct
      // itinerary_items update here would be the non-atomic path regressing.
      if (table === "itinerary_items") {
        return {
          select: () => ({
            eq: () => ({
              async not() {
                return { data: visits, error: null };
              },
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
    async rpc(name: string, args: Record<string, unknown>) {
      recorded.rpcCalls.push({ name, args });
      return { error: options.rpcError ? { message: options.rpcError } : null };
    },
  };
}
