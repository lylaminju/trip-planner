import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LoginPage } from "@/components/LoginPage";
import { SERVICE_TITLE } from "@/lib/service-brand";

describe("LoginPage landing page", () => {
  it("renders public landing CTAs with request access as the primary action", () => {
    const markup = renderToStaticMarkup(createElement(LoginPage));

    expect(markup).toContain(SERVICE_TITLE);
    expect(markup).toContain("Request access");
    expect(markup).toContain("Opens your email app to request an invite.");
    expect(markup).toContain('href="#sign-in"');
    expect(markup).toContain("mailto:mjuudev@gmail.com");
    expect(markup).toContain("Plotinerary%20access%20request");
    expect(markup).toContain("By Minju Park");
    expect(markup).toContain("LinkedIn");
    expect(markup).toContain("https://www.linkedin.com/in/lylaminju");
  });

  it("shows a faithful planner preview with route segment rows", () => {
    const markup = renderToStaticMarkup(createElement(LoginPage));

    expect(markup).toContain("Weekend trip");
    expect(markup).toContain("Day 2");
    expect(markup).toContain("09:30 First stop");
    expect(markup).toContain("11:10 Lunch stop");
    expect(markup).toContain("14:20 Afternoon walk");
    expect(markup).toContain("Opens early, good starting point");
    expect(markup).toContain("Reservation note saved here");
    expect(markup).toContain("Check hours before leaving");
    expect(markup).toContain("landing-route-segment");
    expect(markup).toContain("place-row landing-itinerary-stop");
    expect(markup).toContain("route-mode-select");
    expect(markup).toContain("landing-map-marker-label");
    expect(markup).toContain("landing-map-route-halo");
    expect(markup).toContain("walking");
    expect(markup).toContain("transit");
    expect(markup).toContain("18 min");
    expect(markup).toContain("22 min");
    expect(markup).toContain("landing-route-map-link");
  });

  it("keeps the existing sign-in form on the same page", () => {
    const markup = renderToStaticMarkup(createElement(LoginPage));

    expect(markup).toContain('id="sign-in"');
    expect(markup).toContain("<h2");
    expect(markup).toContain("Sign in</h2>");
    expect(markup).toContain('name="email_local"');
    expect(markup).toContain('name="email_domain"');
    expect(markup).toContain('name="password"');
  });
});
