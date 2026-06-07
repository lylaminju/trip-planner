import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LoginPage } from "@/components/LoginPage";

describe("LoginPage landing page", () => {
  it("renders public landing CTAs with request access as the primary action", () => {
    const markup = renderToStaticMarkup(createElement(LoginPage));

    expect(markup).toContain("Trip Planner");
    expect(markup).toContain("Request access");
    expect(markup).toContain("View sample trip");
    expect(markup).toContain('href="#sample-trip"');
    expect(markup).toContain('href="#sign-in"');
    expect(markup).toContain("mailto:mjuudev@gmail.com");
    expect(markup).toContain("Trip%20Planner%20access%20request");
  });

  it("shows a faithful planner preview with route segment rows", () => {
    const markup = renderToStaticMarkup(createElement(LoginPage));

    expect(markup).toContain("Weekend trip, 4 days");
    expect(markup).toContain("Day 2");
    expect(markup).toContain("09:30 First stop");
    expect(markup).toContain("11:10 Lunch stop");
    expect(markup).toContain("14:20 Afternoon walk");
    expect(markup).toContain("landing-route-segment");
    expect(markup).toContain("walking");
    expect(markup).toContain("transit");
    expect(markup).toContain("18 min");
    expect(markup).toContain("22 min");
    expect(markup).toContain("landing-route-map-link");
    expect(markup).not.toContain("Morning route");
    expect(markup).not.toContain("Walking · 3 places");
  });

  it("keeps the existing sign-in form on the same page", () => {
    const markup = renderToStaticMarkup(createElement(LoginPage));

    expect(markup).toContain('id="sign-in"');
    expect(markup).toContain("<h2");
    expect(markup).toContain("Sign in</h2>");
    expect(markup).toContain('name="email_local"');
    expect(markup).toContain('name="email_domain"');
    expect(markup).toContain('name="password"');
    expect(markup).toContain("Access is limited to manually created accounts.");
  });
});
