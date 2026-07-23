import fs from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LandingPage } from "@/components/LandingPage";
import { SignInPage } from "@/components/SignInPage";
import { LandingAiDemo } from "@/components/landing/LandingAiDemo";
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
import {
  AI_CREATE_ITINERARY_LABEL,
  AI_INTEREST_TAG_OPTIONS,
  AI_PACE_PRESETS,
  AI_TRAVEL_MODE_OPTIONS,
} from "@/lib/ai-planning-preferences";
import { SERVICE_TITLE } from "@/lib/service-brand";

describe("LandingPage", () => {
  it("renders public landing CTAs with request access as the primary action", () => {
    const markup = renderToStaticMarkup(createElement(LandingPage));

    expect(markup).toContain(SERVICE_TITLE);
    // Request-access CTA targets the invite mailto; sign-in is a route.
    expect(markup).toContain("mailto:mjuudev@gmail.com");
    expect(markup).toContain("TripGlance%20access%20request");
    expect(markup).toContain('href="/sign-in"');
    // Compliance disclaimer must stay on the public page.
    expect(markup).toContain("Not affiliated with Google Maps");
    expect(markup).toContain('class="landing-footer"');

    const heroActions = markupBetween(markup, "landing-hero-actions", "div");
    // Primary action is the request-access CTA; the showcase link is secondary.
    expect(heroActions).toContain(
      'class="landing-primary-action" href="mailto:',
    );
    expect(heroActions).toContain('href="#showcase"');
    expect(linkCount(heroActions)).toBe(2);

    const nav = markupBetween(markup, "marketing-nav", "nav");
    expect(nav).toContain('href="#showcase"');
    expect(nav).toContain('href="#features"');
    expect(nav).toContain('href="/sign-in"');
    expect(nav).toContain("mailto:mjuudev@gmail.com");
    expect(linkCount(nav)).toBe(4);
  });

  it("leads with the guest demo CTAs when guest mode is configured", () => {
    process.env.GUEST_SESSION_SECRET = "test-secret";
    process.env.GUEST_SAMPLE_TRIP_ID = "1";
    try {
      const markup = renderToStaticMarkup(createElement(LandingPage));

      const heroActions = markupBetween(markup, "landing-hero-actions", "div");
      // Primary action clones the sample trip; planning your own is secondary.
      expect(heroActions).toContain("landing-sample-trip-cta");
      expect(heroActions).toContain('href="/try"');
      // The invite request stays reachable from the hero access copy.
      expect(markup).toContain("mailto:mjuudev@gmail.com");
    } finally {
      delete process.env.GUEST_SESSION_SECRET;
      delete process.env.GUEST_SAMPLE_TRIP_ID;
    }
  });

  it("shows the browser-style planner preview with route segment rows", () => {
    const markup = renderToStaticMarkup(createElement(LandingPage));

    expect(markup).toContain('id="planner-preview"');
    expect(markup).toContain('class="landing-browser-shell"');
    expect(markup).toContain('aria-label="Sample planner preview"');
    expect(markup).toContain("landing-browser-dot");
    expect(markup).toContain("Day 1");
    expect(markup).toContain("10:00 Airport");
    expect(markup).toContain("11:50 Hotel");
    expect(markup).toContain("16:30 Park");
    expect(markup).toContain("Arrive and collect bags");
    expect(markup).toContain("Check in and drop your bags");
    expect(markup).toContain("Golden-hour stroll and views");
    // Each preview visit carries an emoji thumbnail affordance.
    expect(markup).toContain("landing-stop-thumb");
    // Time sits in its own column (like the real planner), not inline in the title.
    expect(markup).toContain("landing-stop-time");
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
    expect(markup).toContain('aria-label="Edit Airport"');
    expect(markup).toContain('aria-label="Delete Airport"');
  });

  it("places the AI planner demo between the planner preview and the showcase", () => {
    const markup = renderToStaticMarkup(createElement(LandingPage));

    const previewIndex = markup.indexOf('id="planner-preview"');
    const aiDemoIndex = markup.indexOf('id="ai-planner"');
    const showcaseIndex = markup.indexOf('id="showcase"');

    expect(aiDemoIndex).toBeGreaterThan(previewIndex);
    expect(aiDemoIndex).toBeLessThan(showcaseIndex);
  });

  it("offers every real planning option in the AI planner demo", () => {
    const markup = decodeEntities(
      renderToStaticMarkup(createElement(LandingAiDemo)),
    );

    for (const preset of AI_PACE_PRESETS) {
      expect(markup).toContain(preset.label);
    }
    for (const option of AI_INTEREST_TAG_OPTIONS) {
      expect(markup).toContain(option.label);
    }
    for (const option of AI_TRAVEL_MODE_OPTIONS) {
      expect(markup).toContain(option.label);
    }

    const balanced = AI_PACE_PRESETS.find(
      (preset) => preset.label === "Balanced",
    );
    expect(markup).toContain(balanced?.descriptor);
    expect(markup).toContain("2-3 visits/day");
    expect(markup).toContain(AI_CREATE_ITINERARY_LABEL);
  });

  it("shows the AI draft as an editable dated itinerary", () => {
    const markup = renderToStaticMarkup(createElement(LandingAiDemo));

    expect(markup).toContain("Fri, Apr 3");
    expect(markup).toContain("09:00 Airport");
    expect(markup).toContain("11:30 Hotel");
    expect(markup).toContain("15:00 Park");
    expect(markup).toContain('aria-label="Edit Park"');
    expect(markup).toContain('aria-label="Delete Park"');
    expect(markup).toContain("landing-stop-thumb");
    expect(markup).toContain('aria-label="Travel mode: Transit"');
  });

  it("restores the workflow showcase between the preview and feature proof", () => {
    const markup = renderToStaticMarkup(createElement(LandingPage));

    expect(markup).toContain('class="landing-workflow-section"');
    expect(markup).toContain('id="showcase"');
    expect(markup).toContain("Plan by day");
    expect(markup).toContain("See the map");
    expect(markup).toContain("Time your routes");
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
    expect(markup).toContain("Airport");
    expect(markup).toContain("11:00");
    expect(markup).toContain("Hotel");
    expect(markup).toContain("unscheduled-block");
    expect(markup).toContain("Unscheduled");
    expect(markup).toContain("Park");
    expect(markup).toContain("landing-stop-thumb");
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
      'class="place-row landing-itinerary-stop" aria-label="09:30 Airport"',
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
    expect(markup).toContain("route-segment-map-link");
    expect(markup).toContain("Open route in Google Maps");
    expect(markup).toContain("Hotel");

  });

  it("keeps landing itinerary order numbers styled as compact marker badges", () => {
    const css = fs.readFileSync(
      "src/styles/components/landing-preview.css",
      "utf8",
    );
    const markerRule = cssRule(
      css,
      ".landing-product-frame .place-marker-label,\n.landing-workflow-product-frame .place-marker-label",
    );

    expect(markerRule).toContain("align-items: center;");
    expect(markerRule).toContain("border-radius: 999px;");
    expect(markerRule).toContain("color: var(--text-on-accent);");
    expect(markerRule).toContain("display: inline-flex;");
    expect(markerRule).toContain("flex: 0 0 18px;");
    expect(markerRule).toContain("font-size: 10px;");
    expect(markerRule).toContain("height: 18px;");
    expect(markerRule).toContain("justify-content: center;");
    expect(markerRule).toContain("margin-right: 6px;");
    expect(markerRule).toContain("width: 18px;");
  });

  it("removes divider lines between preview visits to match the real planner", () => {
    const css = fs.readFileSync(
      "src/styles/components/landing-preview.css",
      "utf8",
    );
    // The combined class must outrank the later-imported base `.place-row`
    // border-top, so the fix cannot be silently lost to stylesheet order.
    const stopRule = cssRule(css, ".place-row.landing-itinerary-stop");

    expect(stopRule).toContain("border-top: 0;");
  });

  it("shows feature proof below the workflow showcase", () => {
    const markup = renderToStaticMarkup(createElement(LandingPage));

    expect(markup).toContain("landing-feature-icon");
    expect(markup).toContain(
      'class="landing-feature-icon landing-feature-icon-maps landing-feature-icon-outline"',
    );
    // Feature labels the section advertises (not the surrounding marketing prose).
    expect(markup).toContain("Date buckets");
    expect(markup).toContain("Google Maps routes");
    expect(markup).toContain("Route segments");
    expect(markup).toContain("Trip dashboard");
    expect(markup).toContain("Plan with AI");
  });

  it("keeps final CTA mobile actions balanced as equal-width touch targets", () => {
    const landingCss = fs.readFileSync(
      "src/styles/components/landing.css",
      "utf8",
    );
    const mobileCss = cssMediaBlock(landingCss, "@media (max-width: 560px)");

    expect(mobileCss).toContain(
      ".landing-final-cta .landing-primary-action,\n  .landing-final-cta .landing-secondary-action",
    );
    expect(mobileCss).toContain("flex: 1 1 0;");
    expect(mobileCss).toContain("min-width: 0;");
    expect(mobileCss).toContain(".landing-hero .landing-primary-action");
    expect(mobileCss).toContain("flex: 0 0 auto;");
  });

  it("renders landing route segments with a non-clickable Google Maps route action", () => {
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
    expect(markup).toContain(
      'class="route-segment-map-link" aria-label="Open route in Google Maps"',
    );
    expect(markup).toContain("route-segment-actions");
    expect(markup).toContain("route-segment-map-label");
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
    expect(offMarkup).toContain("Route legs");
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
    expect(markup).toContain('class="auth-shell"');
    expect(markup).toContain('class="auth-card"');
    // Shared chrome: link home, footer landmark, and the request-access CTA.
    expect(markup).toContain('href="/"');
    expect(markup).toContain('class="landing-footer"');
    expect(markup).toContain('href="mailto:mjuudev@gmail.com');
    // Sign-in form field contract.
    expect(markup).toContain('name="email"');
    expect(markup).toContain('type="email"');
    expect(markup).toContain('name="password"');
    // The lean sign-in page must not embed the marketing preview.
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

function decodeEntities(markup: string) {
  return markup.replaceAll("&amp;", "&").replaceAll("&#x27;", "'");
}

function cssMediaBlock(css: string, mediaQuery: string) {
  const start = css.indexOf(mediaQuery);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextMedia = css.indexOf("\n@media", start + mediaQuery.length);

  return css.slice(start, nextMedia === -1 ? undefined : nextMedia);
}

function cssRule(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n}", start);
  expect(end).toBeGreaterThanOrEqual(0);

  return css.slice(start, end + 2);
}
