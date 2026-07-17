import { describe, expect, it, vi } from "vitest";

import { sortMembershipsForDisplay } from "@/server/trip-members";
import type { TripMembership } from "@/lib/types";

type Row = Record<string, unknown>;

function createFakeSupabase(state: { profiles: Row[]; memberships: Row[] }) {
  const inserts: Row[] = [];

  function makeQuery(table: "profiles" | "trip_memberships") {
    const filters: Record<string, unknown> = {};
    let operation: "select" | "insert" | "delete" = "select";

    function matches(row: Row): boolean {
      return Object.entries(filters).every(([column, value]) =>
        Array.isArray(value) ? value.includes(row[column]) : row[column] === value,
      );
    }

    function rows(): Row[] {
      const source = table === "profiles" ? state.profiles : state.memberships;
      return source.filter(matches);
    }

    function settle() {
      if (operation === "delete") {
        state.memberships = state.memberships.filter((row) => !matches(row));
        return { error: null };
      }
      return { data: rows(), error: null };
    }

    const query = {
      select: () => query,
      insert: (row: Row) => {
        operation = "insert";
        inserts.push(row);
        state.memberships.push({ created_at: "2026-01-04T00:00:00.000Z", ...row });
        return Promise.resolve({ error: null });
      },
      delete: () => {
        operation = "delete";
        return query;
      },
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return query;
      },
      in: (column: string, values: unknown[]) => {
        filters[column] = values;
        return query;
      },
      order: () => query,
      maybeSingle: () =>
        Promise.resolve({ data: rows()[0] ?? null, error: null }),
      then: (
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(settle()).then(resolve, reject),
    };
    return query;
  }

  return {
    client: { from: (table: "profiles" | "trip_memberships") => makeQuery(table) },
    inserts,
  };
}

async function withMemberMutations(
  state: { profiles: Row[]; memberships: Row[] },
  run: (
    module: typeof import("@/server/trip-members"),
    inserts: Row[],
  ) => Promise<void>,
): Promise<void> {
  vi.resetModules();
  const fake = createFakeSupabase(state);
  vi.doMock("@/server/supabase", () => ({
    getSupabaseClient: () => fake.client,
  }));

  try {
    await run(await import("@/server/trip-members"), fake.inserts);
  } finally {
    vi.doUnmock("@/server/supabase");
    vi.restoreAllMocks();
    vi.resetModules();
  }
}

function membership(
  userId: string,
  role: TripMembership["role"],
  createdAt: string,
): TripMembership {
  return {
    trip_id: 1,
    user_id: userId,
    role,
    created_at: createdAt,
  };
}

describe("addTripMemberByEmail", () => {
  const ownerMembership = {
    trip_id: 1,
    user_id: "owner-1",
    role: "owner",
    created_at: "2026-01-01T00:00:00.000Z",
  };

  it("rejects emails without a matching account", async () => {
    await withMemberMutations(
      { profiles: [], memberships: [ownerMembership] },
      async ({ addTripMemberByEmail }) => {
        await expect(
          addTripMemberByEmail(1, "ghost@example.com", "viewer"),
        ).rejects.toThrow("No account found for that email.");
      },
    );
  });

  it("rejects users who are already members", async () => {
    await withMemberMutations(
      {
        profiles: [{ user_id: "owner-1", email: "owner@example.com" }],
        memberships: [ownerMembership],
      },
      async ({ addTripMemberByEmail }) => {
        await expect(
          addTripMemberByEmail(1, "owner@example.com", "viewer"),
        ).rejects.toThrow("That user is already a member of this trip.");
      },
    );
  });

  it("adds the matched user with the requested role and returns the roster", async () => {
    await withMemberMutations(
      {
        profiles: [
          { user_id: "owner-1", email: "owner@example.com", username: "Lyla" },
          { user_id: "friend-1", email: "friend@example.com", username: "Sam" },
        ],
        memberships: [ownerMembership],
      },
      async ({ addTripMemberByEmail }, inserts) => {
        const members = await addTripMemberByEmail(
          1,
          "friend@example.com",
          "viewer",
        );

        expect(inserts).toEqual([
          { trip_id: 1, user_id: "friend-1", role: "viewer" },
        ]);
        expect(members.map((entry) => entry.user_id)).toEqual([
          "owner-1",
          "friend-1",
        ]);
        expect(members[1]).toMatchObject({ role: "viewer", username: "Sam" });
      },
    );
  });
});

describe("removeTripMember", () => {
  it("deletes the membership and returns the remaining roster", async () => {
    await withMemberMutations(
      {
        profiles: [
          { user_id: "owner-1", email: "owner@example.com", username: "Lyla" },
          { user_id: "friend-1", email: "friend@example.com", username: "Sam" },
        ],
        memberships: [
          {
            trip_id: 1,
            user_id: "owner-1",
            role: "owner",
            created_at: "2026-01-01T00:00:00.000Z",
          },
          {
            trip_id: 1,
            user_id: "friend-1",
            role: "viewer",
            created_at: "2026-01-02T00:00:00.000Z",
          },
        ],
      },
      async ({ removeTripMember }) => {
        const members = await removeTripMember(1, "friend-1");

        expect(members.map((entry) => entry.user_id)).toEqual(["owner-1"]);
      },
    );
  });
});

describe("sortMembershipsForDisplay", () => {
  it("puts the owner first and keeps join order for the rest", () => {
    const sorted = sortMembershipsForDisplay([
      membership("viewer-early", "viewer", "2026-01-01T00:00:00.000Z"),
      membership("owner", "owner", "2026-01-02T00:00:00.000Z"),
      membership("viewer-late", "viewer", "2026-01-03T00:00:00.000Z"),
    ]);

    expect(sorted.map((entry) => entry.user_id)).toEqual([
      "owner",
      "viewer-early",
      "viewer-late",
    ]);
  });
});
