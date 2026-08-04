import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProfilePage } from "@/components/ProfilePage";

describe("ProfilePage", () => {
  it("offers logging out from the profile settings card", () => {
    const markup = renderToStaticMarkup(
      createElement(ProfilePage, {
        initialUsername: "Traveler",
        initialProfileColor: "#2563eb",
        userEmail: "traveler@example.com",
      }),
    );

    expect(markup).toContain('class="profile-logout-button"');
    expect(markup).toContain("Log out");
  });
});
