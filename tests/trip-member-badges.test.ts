import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TripMemberBadges } from "@/components/TripMemberBadges";
import type { TripMemberSummary } from "@/lib/types";

const CURRENT_USER_ID = "user-1";

function member(overrides: Partial<TripMemberSummary> = {}): TripMemberSummary {
  return {
    user_id: "user-2",
    role: "viewer",
    username: "Mina",
    profile_color: "#4f46e5",
    ...overrides,
  };
}

function renderBadges(
  members: TripMemberSummary[],
  overrides: Partial<Parameters<typeof TripMemberBadges>[0]> = {},
) {
  return renderToStaticMarkup(
    createElement(TripMemberBadges, {
      members,
      currentUserId: CURRENT_USER_ID,
      size: "md",
      maxVisible: 2,
      ...overrides,
    }),
  );
}

describe("TripMemberBadges", () => {
  it("renders nothing when the current user is the only member", () => {
    const markup = renderBadges([
      member({ user_id: CURRENT_USER_ID, role: "owner" }),
    ]);

    expect(markup).toBe("");
  });

  it("shows the other members' initials with their profile colors", () => {
    const markup = renderBadges([
      member({ user_id: CURRENT_USER_ID, role: "owner", username: "Lyla" }),
      member({ user_id: "user-2", username: "Mina" }),
      member({ user_id: "user-3", username: "jun", profile_color: null }),
    ]);

    expect(markup).toContain(">M<");
    expect(markup).toContain(">J<");
    expect(markup).not.toContain(">L<");
    expect(markup).toContain('aria-label="Shared with Mina and jun"');
  });

  it("collapses members beyond maxVisible into an overflow chip", () => {
    const markup = renderBadges(
      [
        member({ user_id: "user-2", username: "Mina" }),
        member({ user_id: "user-3", username: "Jun" }),
        member({ user_id: "user-4", username: "Sora" }),
        member({ user_id: "user-5", username: "Dana" }),
      ],
      { maxVisible: 2 },
    );

    expect(markup).toContain('class="trip-member-badge trip-member-badge-overflow"');
    expect(markup).toContain(">+2<");
    expect(markup).toContain('aria-label="Shared with Mina, Jun and 2 more"');
  });

  it("falls back to a Traveler identity when a member has no username", () => {
    const markup = renderBadges([member({ username: null })]);

    expect(markup).toContain(">T<");
    expect(markup).toContain('aria-label="Shared with Traveler"');
  });
});
