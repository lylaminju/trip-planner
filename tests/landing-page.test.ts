import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LandingPage } from "@/components/LandingPage";
import {
  LandingRouteDetailsToggle,
  LandingRouteSegment,
} from "@/components/landing/LandingPlannerRows";
import { SERVICE_TITLE } from "@/lib/service-brand";

describe("LandingPage", () => {
  it("renders public landing CTAs with request access as the primary action", () => {
    const markup = renderToStaticMarkup(createElement(LandingPage));

    expect(markup).toContain(SERVICE_TITLE);
    expect(markup).toContain("Trip planning,");
    expect(markup).toContain("at a glance.");
    expect(markup).toContain("Plan the itinerary and map the route");
    expect(markup).toContain("Request invite");
    expect(markup).toContain("Already invited? Sign in");
    expect(markup).toContain('Email <a href="mailto:mjuudev@gmail.com');
    expect(markup).toContain(
      "mjuudev@gmail.com</a> directly if your email app does not open.",
    );
    expect(markup).toContain('href="#sign-in"');
    expect(markup).toContain("mailto:mjuudev@gmail.com");
    expect(markup).toContain("TripGlance%20access%20request");
    expect(markup).toContain("By Minju Park");
    expect(markup).toContain("LinkedIn");
    expect(markup).toContain("https://www.linkedin.com/in/lylaminju");
  });

  it("shows a faithful planner preview with route segment rows", () => {
    const markup = renderToStaticMarkup(createElement(LandingPage));

    expect(markup).toContain("Day 1");
    expect(markup).toContain("10:00 Brunch cafe");
    expect(markup).toContain("11:50 Museum");
    expect(markup).toContain("16:30 Bookstore");
    expect(markup).toContain("Late breakfast and coffee");
    expect(markup).toContain("Exhibits and a short gallery loop");
    expect(markup).toContain("New releases and a few slow laps");
    expect(markup).toContain("landing-route-segment");
    expect(markup).toContain("place-row landing-itinerary-stop");
    expect(markup).toContain("landing-preview-sheet-handle");
    expect(markup).toContain("route-mode-trigger");
    expect(markup).toContain("landing-abstract-map-block");
    expect(markup).toContain("landing-map-marker-label");
    expect(markup).toContain("landing-map-route-halo");
    expect(markup).not.toContain("landing-map-road");
    expect(markup).not.toContain("OpenStreetMap");
    expect(markup).not.toContain("landing-map-osm");
    expect(markup).toContain('aria-label="Travel mode: Walking"');
    expect(markup).toContain('aria-label="Travel mode: Transit"');
    expect(markup).toContain("18 min");
    expect(markup).toContain("22 min");
    expect(markup).toContain("landing-route-map-link");
    expect(markup).toContain('aria-label="Edit Brunch cafe"');
    expect(markup).toContain('aria-label="Delete Brunch cafe"');
  });

  it("shows an interactive workflow proof for the middle section", () => {
    const markup = renderToStaticMarkup(createElement(LandingPage));

    expect(markup).toContain("From saved place to mapped day");
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain("Add a Maps place");
    expect(markup).toContain("Place it on the day");
    expect(markup).toContain("Check the route");
    expect(markup).toContain("landing-workflow-product-frame");
    expect(markup).toContain("landing-preview-sheet-handle");
    expect(markup).toContain("Paste a Google Maps link");
    expect(markup).toContain("Google Maps link");
    expect(markup).toContain("maps.app.goo.gl/brunch-cafe");
    expect(markup).toContain("Add Place");
    expect(markup).toContain("Place details ready");
    expect(markup).toContain('aria-label="Add Brunch cafe to itinerary"');
    expect(markup).not.toContain("Add stop");
    expect(markup).not.toContain("landing-workflow-marker-label");
    expect(markup).not.toContain("landing-workflow-saved-place");
    expect(markup).not.toContain("landing-workflow-visual");
    expect(markup).not.toContain("landing-workflow-map-road");
    expect(markup).not.toContain("OpenStreetMap");
    expect(markup).not.toContain("Maps link ready");
    expect(markup).not.toContain("Selected workflow step");
    expect(markup).not.toContain("Google Maps places");
  });

  it("renders landing route segments with the product route row structure", () => {
    const markup = renderToStaticMarkup(
      createElement(LandingRouteSegment, {
        mode: "walking",
        duration: "18 min",
      }),
    );

    expect(markup).toContain('class="segment-row landing-route-segment"');
    expect(markup).toContain("route-mode-picker");
    expect(markup).toContain("route-mode-trigger");
    expect(markup).toContain("route-mode-chevron");
    expect(markup).toContain("route-duration");
    expect(markup).toContain("small-button landing-route-map-link");
    expect(markup).toContain('aria-label="Travel mode: Walking"');
    expect(markup).not.toContain("landing-route-segment active");
    expect(markup).not.toContain("landing-workflow-route");
  });

  it("renders route details toggle states with the product switch structure", () => {
    const offMarkup = renderToStaticMarkup(
      createElement(LandingRouteDetailsToggle, { active: false }),
    );
    const onMarkup = renderToStaticMarkup(
      createElement(LandingRouteDetailsToggle, { active: true }),
    );

    expect(offMarkup).toContain('class="route-segment-toggle"');
    expect(offMarkup).toContain('role="switch"');
    expect(offMarkup).toContain('aria-checked="false"');
    expect(offMarkup).toContain("Route details");
    expect(offMarkup).toContain("route-segment-switch-track");
    expect(offMarkup).not.toContain("route-segment-toggle active");

    expect(onMarkup).toContain('class="route-segment-toggle active"');
    expect(onMarkup).toContain('role="switch"');
    expect(onMarkup).toContain('aria-checked="true"');
    expect(onMarkup).toContain("route-segment-switch-knob");
  });

  it("keeps the existing sign-in form on the same page", () => {
    const markup = renderToStaticMarkup(createElement(LandingPage));

    expect(markup).toContain('id="sign-in"');
    expect(markup).toContain("<h2");
    expect(markup).toContain("Open your trip planner</h2>");
    expect(markup).toContain('name="email"');
    expect(markup).toContain('type="email"');
    expect(markup).toContain('name="password"');
    expect(markup).not.toContain("Use the email attached to your invite.");
  });
});
