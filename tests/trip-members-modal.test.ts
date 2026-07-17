import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TripMembersModal } from "@/components/TripMembersModal";
import type { TripMemberSummary } from "@/lib/types";

function member(overrides: Partial<TripMemberSummary> = {}): TripMemberSummary {
  return {
    user_id: "user-1",
    role: "owner",
    username: "Lyla",
    profile_color: "#0d9488",
    ...overrides,
  };
}

function renderModal(
  props: Partial<Parameters<typeof TripMembersModal>[0]> = {},
) {
  return renderToStaticMarkup(
    createElement(TripMembersModal, {
      tripId: 1,
      tripName: "Toronto June",
      destination: "Toronto",
      destinationSlug: "toronto",
      members: [
        member(),
        member({ user_id: "user-2", role: "viewer", username: "Sam" }),
      ],
      currentUserId: "user-1",
      onClose: vi.fn(),
      onMembersChange: vi.fn(),
      ...props,
    }),
  );
}

describe("TripMembersModal", () => {
  it("renders an invite form with an email field and submit", () => {
    const markup = renderModal();

    expect(markup).toContain('name="email"');
    expect(markup).toContain('type="email"');
    expect(markup).toContain('type="submit"');
  });

  it("hides the role picker until an account is confirmed", () => {
    // The role radiogroup only renders once the email resolves to an account,
    // so the initial (unresolved) render must not expose it.
    const markup = renderModal();

    expect(markup).not.toContain('name="role"');
  });

  it("lists every member with a remove action only for other members", () => {
    const markup = renderModal();

    expect(markup).toContain("Lyla");
    expect(markup).toContain("Sam");
    expect(markup).toContain('aria-label="Remove Sam from trip"');
    expect(markup).not.toContain('aria-label="Remove Lyla from trip"');
  });

  it("marks the current user's own row", () => {
    const markup = renderModal();

    expect(markup).toContain("(you)");
  });

  it("shows a compact header with trip name, destination, and close", () => {
    const markup = renderModal();

    expect(markup).toContain('class="modal trip-create-modal trip-members-modal"');
    expect(markup).toContain("Toronto June");
    expect(markup).toContain('class="trip-members-header-destination"');
    expect(markup).toContain('aria-label="Close"');
  });
});
