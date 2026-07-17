import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MemberEmailLookup } from "@/hooks/useMemberEmailLookup";

const lookupMock = vi.fn<(email: string) => MemberEmailLookup>();

vi.mock("@/hooks/useMemberEmailLookup", () => ({
  useMemberEmailLookup: (email: string) => lookupMock(email),
}));

// Imported after the mock so the component picks up the mocked hook.
import { TripInviteFields } from "@/components/TripInviteFields";

function renderFields(email: string) {
  return renderToStaticMarkup(
    createElement(TripInviteFields, {
      email,
      role: "viewer",
      emailLabel: "Invite by email",
      emailRequired: true,
      onEmailChange: vi.fn(),
      onRoleChange: vi.fn(),
    }),
  );
}

afterEach(() => {
  lookupMock.mockReset();
});

describe("TripInviteFields", () => {
  it("keeps the role picker and hint hidden while the email is unresolved", () => {
    lookupMock.mockReturnValue({ status: "idle" });

    const markup = renderFields("");

    expect(markup).toContain('name="email"');
    expect(markup).not.toContain('name="role"');
    expect(markup).not.toContain("Owners can edit the trip.");
  });

  it("reveals the role picker and hint once an account is confirmed", () => {
    lookupMock.mockReturnValue({ status: "found", username: "Sam" });

    const markup = renderFields("sam@example.com");

    expect(markup).toContain("✓ Sam");
    expect(markup).toContain('name="role"');
    expect(markup).toContain('value="viewer"');
    expect(markup).toContain('value="owner"');
    expect(markup).toContain("Owners can edit the trip.");
  });

  it("does not reveal the role picker when no account is found", () => {
    lookupMock.mockReturnValue({ status: "not-found" });

    const markup = renderFields("ghost@example.com");

    expect(markup).toContain("No account found for that email.");
    expect(markup).not.toContain('name="role"');
  });
});
