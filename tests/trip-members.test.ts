import { describe, expect, it } from "vitest";

import { sortMembershipsForDisplay } from "@/server/trip-members";
import type { TripMembership } from "@/lib/types";

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
