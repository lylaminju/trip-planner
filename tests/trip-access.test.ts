import { describe, expect, it, vi } from "vitest";

import { guestPrincipalId } from "@/server/principal";

const GUEST_ID = "8e7a1c0e-1111-4222-8333-444455556666";

type TripRow = {
  id: number;
  guest_owner_id: string;
  expires_at: string | null;
  created_at: string;
} | null;

function guestTripClient(row: TripRow, filters: Record<string, unknown>) {
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      return builder;
    },
    is: (column: string, value: unknown) => {
      filters[column] = value;
      return builder;
    },
    maybeSingle: async () => ({ data: row, error: null }),
  };
  return { from: () => builder };
}

async function loadRequireTripRole(row: TripRow, filters: Record<string, unknown>) {
  vi.resetModules();
  vi.doMock("@/server/supabase", () => ({
    getSupabaseClient: () => guestTripClient(row, filters),
  }));
  const { requireTripRole } = await import("@/server/trip-access");
  return requireTripRole;
}

function unmock() {
  vi.doUnmock("@/server/supabase");
  vi.restoreAllMocks();
  vi.resetModules();
}

describe("trip-access guest principals", () => {
  it("grants owner access to an unexpired guest-owned trip", async () => {
    const filters: Record<string, unknown> = {};
    const requireTripRole = await loadRequireTripRole(
      {
        id: 7,
        guest_owner_id: GUEST_ID,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        created_at: "2026-07-23T00:00:00Z",
      },
      filters,
    );

    try {
      const membership = await requireTripRole(7, guestPrincipalId(GUEST_ID), "owner");

      expect(membership.role).toBe("owner");
      expect(membership.user_id).toBe(guestPrincipalId(GUEST_ID));
      // The lookup must scope by the guest owner and exclude deleted trips.
      expect(filters.guest_owner_id).toBe(GUEST_ID);
      expect(filters.deleted_at).toBeNull();
    } finally {
      unmock();
    }
  });

  it("denies access to an expired guest trip", async () => {
    const requireTripRole = await loadRequireTripRole(
      {
        id: 7,
        guest_owner_id: GUEST_ID,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
        created_at: "2026-07-20T00:00:00Z",
      },
      {},
    );

    try {
      await expect(
        requireTripRole(7, guestPrincipalId(GUEST_ID), "owner"),
      ).rejects.toThrow("access");
    } finally {
      unmock();
    }
  });

  it("denies access when the trip has no expiry", async () => {
    // A guest-owned trip without expires_at is malformed; fail closed.
    const requireTripRole = await loadRequireTripRole(
      {
        id: 7,
        guest_owner_id: GUEST_ID,
        expires_at: null,
        created_at: "2026-07-20T00:00:00Z",
      },
      {},
    );

    try {
      await expect(
        requireTripRole(7, guestPrincipalId(GUEST_ID), "owner"),
      ).rejects.toThrow();
    } finally {
      unmock();
    }
  });

  it("denies access when no matching guest trip exists", async () => {
    const requireTripRole = await loadRequireTripRole(null, {});

    try {
      await expect(
        requireTripRole(7, guestPrincipalId(GUEST_ID), "owner"),
      ).rejects.toThrow();
    } finally {
      unmock();
    }
  });
});
