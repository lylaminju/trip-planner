import fs from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LandingPage } from "@/components/LandingPage";
import { SignInPage } from "@/components/SignInPage";
import {
  LandingRouteDetailsToggle,
  LandingRouteSegment,
} from "@/components/landing/LandingPlannerRows";
import {
  LANDING_WORKFLOW_STEPS,
  LandingWorkflowMapVisual,
  LandingWorkflowPlanByDayVisual,
  LandingWorkflowRouteTimeVisual,
} from "@/components/landing/LandingWorkflowShowcase";
import { SERVICE_TITLE } from "@/lib/service-brand";

describe("LandingPage", () => {
  it("renders public landing CTAs with request access as the primary action", () => {
    const markup = renderToStaticMarkup(createElement(LandingPage));

    expect(markup).toContain(SERVICE_TITLE);
    expect(markup).toContain("Trip planning, <span");
    expect(markup).toContain("at a glance.");
    expect(markup).toContain(
      "Build each travel day beside the map, with timed stops",
    );
    expect(markup).toContain("Request invite");
    expect(markup).toContain('href="/sign-in"');
    expect(markup).toContain(">Sign in</a>");
    expect(markup).toContain("Invite-only beta");
    expect(markup).toContain("Existing users can");
    expect(markup).toContain("mailto:mjuudev@gmail.com");
    expect(markup).toContain("TripGlance%20access%20request");
    expect(markup).toContain("© 2026 TripGlance");
    expect(markup).toContain("Not affiliated with Google Maps");

    const heroActions = markupBetween(markup, "landing-hero-actions", "div");
    expect(heroActions).toContain('class="landing-primary-action"');
    expect(heroActions).toContain("Request invite");
    expect(heroActions).toContain('href="#showcase"');
    expect(heroActions).toContain("See how it works");
    expect(linkCount(heroActions)).toBe(2);

    const nav = markupBetween(markup, "marketing-nav", "nav");
    expect(nav).toContain('href="#showcase"');
    expect(nav).toContain('href="#features"');
    expect(nav).toContain('href="/sign-in"');
    expect(nav).toContain("Request invite");
    expect(linkCount(nav)).toBe(4);
  });

  it("shows the browser-style planner preview with route segment rows", () => {
    const markup = renderToStaticMarkup(createElement(LandingPage));

    expect(markup).toContain('id="planner-preview"');
    expect(markup).toContain('class="landing-browser-shell"');
    expect(markup).toContain('aria-label="Sample planner preview"');
    expect(markup).toContain("landing-browser-dot");
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
    expect(markup).toContain('aria-label="Travel mode: Walking"');
    expect(markup).toContain('aria-label="Travel mode: Transit"');
    expect(markup).toContain("18 min");
    expect(markup).toContain("22 min");
    expect(markup).toContain('aria-label="Edit Brunch cafe"');
    expect(markup).toContain('aria-label="Delete Brunch cafe"');
  });

  it("restores the workflow showcase between the preview and feature proof", () => {
    const markup = renderToStaticMarkup(createElement(LandingPage));

    expect(markup).toContain('class="landing-workflow-section"');
    expect(markup).toContain('id="showcase"');
    expect(markup).toContain(
      "From a list of places to a plan you can follow.",
    );
    expect(markup).toContain("Plan by day");
    expect(markup).toContain("See the map");
    expect(markup).toContain("Time your routes");
    expect(markup).toContain("A plan that arranges itself.");
    expect(markup).toContain("Group visits into date buckets automatically");
    expect(markup).toContain("Keep unscheduled places visible");
    expect(markup).toContain("landing-workflow-plan-card");
    expect(markup).toContain("Day 1");
    expect(markup).toContain("day-block landing-day-card");
    expect(markup).toContain("place-row landing-itinerary-stop");
    expect(markup).toContain("unscheduled-block");

    expect(markup.indexOf('id="planner-preview"')).toBeLessThan(
      markup.indexOf('id="showcase"'),
    );
    expect(markup.indexOf('id="showcase"')).toBeLessThan(
      markup.indexOf('id="features"'),
    );
  });

  it("renders the workflow map without the date legend overlay", () => {
    const markup = renderToStaticMarkup(createElement(LandingWorkflowMapVisual));

    expect(markup).toContain('class="landing-workflow-map-card"');
    expect(markup).toContain('preserveAspectRatio="xMidYMid slice"');
    expect(markup).toContain("landing-workflow-map-block");
    expect(markup).toContain("landing-workflow-map-route-halo");
    expect(markup).toContain("landing-workflow-map-route");
    expect(markup).toContain("M18 48 H30 V25 H56 V48 H78");
    expect(markup).toContain("landing-workflow-map-marker");
    expect(markup.match(/class="landing-workflow-map-muted-dot"/g)).toHaveLength(
      2,
    );
    expect(markup.match(/r="2.7"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(markup).toContain('dominant-baseline="central"');
    expect(markup).not.toContain("landing-workflow-map-legend");
    expect(markup).not.toContain("Fri Jun 12");
  });

  it("renders the workflow day preview with current planner rows", () => {
    const markup = renderToStaticMarkup(
      createElement(LandingWorkflowPlanByDayVisual),
    );

    expect(markup).toContain("landing-workflow-plan-card");
    expect(markup).toContain("day-block landing-day-card");
    expect(markup).toContain("day-heading");
    expect(markup).toContain("day-collapse-button");
    expect(markup).toContain("day-heading-button");
    expect(markup).toContain("day-heading-prefix");
    expect(markup).toContain("place-row landing-itinerary-stop");
    expect(markup).toContain("09:30");
    expect(markup).toContain("Museum");
    expect(markup).toContain("11:00");
    expect(markup).toContain("Bakery");
    expect(markup).toContain("unscheduled-block");
    expect(markup).toContain("Unscheduled");
    expect(markup).toContain("Park");
    expect(markup).not.toContain("Exhibits and a short gallery loop");
    expect(markup).not.toContain("Coffee and a short break");
    expect(markup).not.toContain("No date yet");
  });

  it("renders the workflow route preview with the icon mode menu", () => {
    const routeStep = LANDING_WORKFLOW_STEPS.find(
      (step) => step.id === "route",
    );
    const markup = renderToStaticMarkup(
      createElement(LandingWorkflowRouteTimeVisual),
    );

    expect(routeStep?.description).toContain(
      "open the external Google Maps route web page",
    );
    expect(routeStep?.points).toContain(
      "Open the external Google Maps route web page",
    );
    expect(markup).toContain("landing-workflow-route-card");
    expect(markup).toContain("place-row landing-itinerary-stop");
    expect(markup).toContain(
      'class="place-row landing-itinerary-stop" aria-label="09:30 Museum"',
    );
    expect(markup).toContain("segment-row landing-route-segment");
    expect(markup).toContain("landing-workflow-open-route-segment");
    expect(markup).not.toContain("Route segment");
    expect(markup).toContain("route-mode-trigger");
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain("route-mode-menu");
    expect(markup).toContain("route-mode-option active");
    expect(markup).toContain("Walking");
    expect(markup).toContain("Transit");
    expect(markup).toContain("Bicycling");
    expect(markup).toContain("Driving");
    expect(markup).toContain("12 min");
    expect(markup).toContain("landing-workflow-google-route-link");
    expect(markup).toContain("Open route in Google Maps");
    expect(markup).toContain("Lunch spot");

    const workflowCss = fs.readFileSync(
      "src/styles/components/landing-workflow.css",
      "utf8",
    );
    expect(workflowCss).toContain("--landing-workflow-preview-height: 324px;");
    expect(workflowCss).toContain(
      "height: var(--landing-workflow-preview-height);",
    );
    expect(workflowCss).toContain(
      "min-height: var(--landing-workflow-preview-height);",
    );
    expect(workflowCss).toContain("position: absolute;");
    expect(workflowCss).toContain("top: 34px;");
  });

  it("shows feature proof and steps below the workflow showcase", () => {
    const markup = renderToStaticMarkup(createElement(LandingPage));

    expect(markup).toContain(
      "Plan the details without losing the shape of the trip",
    );
    expect(markup).toContain("landing-feature-icon");
    expect(markup).toContain(
      'class="landing-feature-icon landing-feature-icon-maps landing-feature-icon-outline"',
    );
    expect(markup).toContain("Date buckets");
    expect(markup).toContain("Google Maps routes");
    expect(markup).toContain("numbered map stops, route lines");
    expect(markup).toContain("Route segments");
    expect(markup).toContain("Trip dashboard");
    expect(markup).toContain("Three steps");
    expect(markup).toContain("Save your places");
    expect(markup).toContain("Arrange by day");
    expect(markup).toContain("Follow the map");
    expect(markup).toContain("Ready to plan your next trip?");
  });

  it("keeps the approved mockup visual details around the browser shell", () => {
    const globalsCss = fs.readFileSync("src/app/globals.css", "utf8");
    const landingCss = fs.readFileSync(
      "src/styles/components/landing.css",
      "utf8",
    );
    const previewCss = fs.readFileSync(
      "src/styles/components/landing-preview.css",
      "utf8",
    );

    expect(globalsCss).toContain("IBM+Plex+Sans");
    expect(globalsCss).toContain("IBM+Plex+Mono");
    expect(landingCss).toContain("font-family: 'IBM Plex Sans'");
    expect(landingCss).toContain("position: sticky");
    expect(landingCss).toContain("padding: 74px 24px 0");
    expect(landingCss).toContain("font-weight: 600");
    expect(landingCss).toContain("letter-spacing: -0.03em");
    expect(landingCss).toContain("border-radius: 11px");
    expect(landingCss).not.toMatch(
      /\.landing-hero h1 span\s*\{[^}]*border-bottom/s,
    );
    expect(previewCss).toContain("margin: 46px auto 0");
    expect(landingCss).toContain(
      "grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    );
    expect(landingCss).toContain("radial-gradient(circle at 1px 1px");
    expect(landingCss).toContain("margin: 70px auto 0");
  });

  it("keeps marketing pages constrained at phone widths", () => {
    const landingCss = fs.readFileSync(
      "src/styles/components/landing.css",
      "utf8",
    );
    const previewCss = fs.readFileSync(
      "src/styles/components/landing-preview.css",
      "utf8",
    );
    const workflowCss = fs.readFileSync(
      "src/styles/components/landing-workflow.css",
      "utf8",
    );
    const themeCss = fs.readFileSync("src/styles/theme.css", "utf8");
    const signInCss = fs.readFileSync(
      "src/styles/components/sign-in.css",
      "utf8",
    );

    expect(landingCss).toContain(
      "grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    );
    expect(landingCss).toContain("padding-inline: clamp(20px, 4vw, 36px);");
    expect(landingCss).toContain(
      '.landing-shell .marketing-nav-link[href="/sign-in"]',
    );
    expect(landingCss).toContain(".landing-hero .landing-hero-actions");
    expect(landingCss).toContain(".landing-hero .landing-primary-action");
    expect(landingCss).toContain(".landing-hero .landing-secondary-action");
    expect(landingCss).toContain("padding-inline: 16px;");
    expect(landingCss).toContain("flex: 0 0 auto;");
    expect(landingCss).toContain("font-size: 42px;");
    expect(landingCss).toContain("font-size: 40px;");
    expect(previewCss).toContain(
      ".landing-product-frame .place-row .icon-button",
    );
    expect(previewCss).toContain("flex-wrap: nowrap;");
    expect(previewCss).toContain(".landing-browser-chrome {\n    display: none;");
    expect(previewCss).toContain("background: var(--landing-device-bezel);");
    expect(previewCss).toContain("border-radius: 34px;");
    expect(previewCss).toContain("border-radius: 26px;");
    expect(previewCss).toContain("padding-inline: 16px;");
    expect(workflowCss).toContain(".landing-workflow-card");
    expect(workflowCss).toContain("box-shadow: var(--landing-workflow-shadow);");
    expect(workflowCss).toContain("grid-template-columns: 1fr 1fr;");
    expect(workflowCss).toContain("--landing-workflow-preview-height: 324px;");
    expect(workflowCss).toContain("max-width: 332px;");
    expect(workflowCss).toContain(".landing-workflow-tab[aria-pressed=\"true\"]");
    expect(themeCss).toContain("--landing-device-bezel:");
    expect(themeCss).toContain(
      "--landing-workflow-shadow: 0 30px 70px -50px rgba(28, 25, 23, 0.4);",
    );
    expect(signInCss).toContain("@media (max-width: 640px)");
    expect(signInCss).toContain("padding: 18px 16px 32px;");
  });

  it("renders landing route segments without a Google Maps external-link action", () => {
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
    expect(markup).toContain('aria-label="Travel mode: Walking"');
    expect(markup).not.toContain("landing-route-map-link");
    expect(markup).not.toContain("Open in Google Maps");
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

    expect(onMarkup).toContain('class="route-segment-toggle active"');
    expect(onMarkup).toContain('role="switch"');
    expect(onMarkup).toContain('aria-checked="true"');
    expect(onMarkup).toContain("route-segment-switch-knob");
  });

  it("moves sign-in to the dedicated page instead of keeping the form inline", () => {
    const markup = renderToStaticMarkup(createElement(LandingPage));

    expect(markup).not.toContain('id="sign-in"');
    expect(markup).not.toContain('name="email"');
    expect(markup).not.toContain('name="password"');
  });

  it("renders the dedicated sign-in page with shared landing chrome", () => {
    const markup = renderToStaticMarkup(createElement(SignInPage));

    expect(markup).toContain('class="sign-in-page-shell"');
    expect(markup).toContain('href="/"');
    expect(markup).toContain('href="mailto:mjuudev@gmail.com');
    expect(markup).toContain('class="auth-shell"');
    expect(markup).toContain('class="auth-card"');
    expect(markup).toContain("Sign in");
    expect(markup).toContain("Use the email tied to your invite");
    expect(markup).toContain('name="email"');
    expect(markup).toContain('type="email"');
    expect(markup).toContain('placeholder="you@example.com"');
    expect(markup).toContain('name="password"');
    expect(markup).toContain('placeholder="Enter your password"');
    expect(markup).toContain("Need access?");
    expect(markup).toContain("Request an invite");
    expect(markup).toContain("Request invite");
    expect(markup).toContain("© 2026 TripGlance");
    expect(markup).not.toContain("preview-panel");
  });
});

function markupBetween(markup: string, className: string, tag: string) {
  const start = markup.indexOf(`class="${className}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const elementStart = markup.lastIndexOf(`<${tag}`, start);
  const elementEnd = markup.indexOf(`</${tag}>`, start);
  expect(elementStart).toBeGreaterThanOrEqual(0);
  expect(elementEnd).toBeGreaterThanOrEqual(0);

  return markup.slice(elementStart, elementEnd + tag.length + 3);
}

function linkCount(markup: string) {
  return markup.match(/<a\b/g)?.length ?? 0;
}
