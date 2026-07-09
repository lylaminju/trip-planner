import type { ReactNode } from "react";

import { requestAccessHref } from "./access";

const FEATURE_CARDS = [
  {
    title: "Date buckets",
    body: "Visits group by date, timed stops first, with compact weekday labels you can scan in a glance.",
    icon: <DashboardIcon />,
    tone: "accent",
  },
  {
    title: "Google Maps routes",
    body: "Visualize each day with numbered map stops, route lines, and travel durations from Google Maps data.",
    icon: <GoogleMapsRoutesIcon />,
    tone: "maps outline",
  },
  {
    title: "Route segments",
    body: "Consecutive stops show travel time. Switch between walking, transit, cycling, or driving on the fly.",
    icon: <RouteSegmentIcon />,
    tone: "route outline",
  },
  {
    title: "Plan with AI",
    body: "Choose your pace, interests, travel modes, and lodging, then generate a dated draft you can edit on the map.",
    icon: <MagicWandIcon />,
    tone: "ai outline",
  },
  {
    title: "Unscheduled places",
    body: "Saved but not slotted in yet? They wait in a separate list, ready to drag onto any day.",
    icon: <PinIcon />,
    tone: "unscheduled outline",
  },
  {
    title: "Trip dashboard",
    body: "Trips are grouped into active and past plans, with undated trips kept visible until you add dates.",
    icon: <CalendarGridIcon />,
    tone: "accent",
  },
] satisfies Array<{
  title: string;
  body: string;
  icon: ReactNode;
  tone: string;
}>;

const STEPS = [
  {
    title: "Save your places",
    body: "Drop in a name, address, or Google Maps link. Build a library of everywhere you want to go.",
  },
  {
    title: "Arrange by day",
    body: "Drag places onto dates, set times, and let each day sort itself.",
  },
  {
    title: "Follow the map",
    body: "Every stop becomes a numbered marker with travel time. Export the plan when it is ready.",
  },
] satisfies Array<{ title: string; body: string }>;

export function LandingFeatureProof() {
  return (
    <>
      <section
        className="landing-feature-section"
        id="features"
        aria-labelledby="landing-features-title"
      >
        <div className="landing-section-heading">
          <p className="landing-section-label">Everything you need</p>
          <h2 id="landing-features-title">
            Plan the details without losing the shape of the trip.
          </h2>
        </div>
        <div className="landing-feature-grid">
          {FEATURE_CARDS.map((feature) => (
            <article className="landing-feature-card" key={feature.title}>
              <div
                className={`landing-feature-icon ${feature.tone
                  .split(" ")
                  .map((tone) => `landing-feature-icon-${tone}`)
                  .join(" ")}`}
                aria-hidden="true"
              >
                {feature.icon}
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="landing-steps-section"
        aria-labelledby="landing-steps-title"
      >
        <div className="landing-steps-panel">
          <div className="landing-section-heading">
            <p className="landing-section-label">Three steps</p>
            <h2 id="landing-steps-title">
              You're a few drags away from a finished itinerary.
            </h2>
          </div>
          <div className="landing-step-grid">
            {STEPS.map((step, index) => (
              <article className="landing-step-card" key={step.title}>
                <div className="landing-step-index-row">
                  <span>{index + 1}</span>
                  <div />
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="landing-final-cta-wrap"
        aria-labelledby="landing-cta-title"
      >
        <div className="landing-final-cta">
          <h2 id="landing-cta-title">Ready to plan your next trip?</h2>
          <p>Request an invite, or sign in if you already have access.</p>
          <div className="landing-hero-actions">
            <a className="landing-primary-action" href={requestAccessHref}>
              Request invite
            </a>
            <a className="landing-secondary-action" href="/sign-in">
              Sign in
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function CalendarGridIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="2" y="3" width="6" height="6" rx="1.4" />
      <rect x="11" y="3" width="6" height="6" rx="1.4" />
      <rect x="2" y="11" width="6" height="6" rx="1.4" />
      <rect x="11" y="11" width="6" height="6" rx="1.4" />
    </svg>
  );
}

function GoogleMapsRoutesIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M5 4.5 C12.5 4.5 13.5 8.2 9 9.7 C4.7 11.1 5.8 15.5 15 15.5" />
      <circle cx="5" cy="4.5" r="2.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15.5" r="2.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function RouteSegmentIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="5" cy="5" r="2.2" />
      <circle cx="15" cy="15" r="2.2" />
      <path d="M5 7.5 V11 a4 4 0 0 0 4 4 h3.5" strokeDasharray="2 2.2" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="14" height="4" rx="1.4" />
      <rect x="3" y="9.5" width="9" height="3" rx="1.2" opacity="0.6" />
      <rect x="3" y="14.5" width="6" height="3" rx="1.2" opacity="0.4" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 2.5 C6.7 2.5 4.5 5 4.5 8 C4.5 12 10 17.5 10 17.5 C10 17.5 15.5 12 15.5 8 C15.5 5 13.3 2.5 10 2.5 Z" />
      <circle cx="10" cy="8" r="2" />
    </svg>
  );
}

function MagicWandIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      className="magic-wand-svg"
    >
      {/* Thick wand body with a transparent tip slot. */}
      <g transform="translate(-4 0)">
        <g transform="rotate(-45 10 10)">
          <path
            d="
              M 3.9 11.15
              H 15
              A 1.45 1.45 0 0 1 16.45 12.6
              V 13.95
              A 1.45 1.45 0 0 1 15 15.4
              H 3.9
              A 2.12 2.12 0 0 1 1.78 13.28
              A 2.12 2.12 0 0 1 3.9 11.15
              Z
              M 12.08 12.12
              H 14.22
              A 0.38 0.38 0 0 1 14.6 12.5
              V 14.05
              A 0.38 0.38 0 0 1 14.22 14.43
              H 12.08
              A 0.38 0.38 0 0 1 11.7 14.05
              V 12.5
              A 0.38 0.38 0 0 1 12.08 12.12
              Z
            "
            fillRule="evenodd"
            style={{ fill: "currentColor", stroke: "none" }}
          />
        </g>
      </g>

      {/* Sparkle 1 (Large 4-pointed star) */}
      <path
        d="M 15 1 Q 15 5 11 5 Q 15 5 15 9 Q 15 5 19 5 Q 15 5 15 1 Z"
        className="wand-sparkle wand-sparkle-1"
        style={{ fill: "currentColor", stroke: "none" }}
      />

      {/* Sparkle 2 (Medium 4-pointed star) */}
      <path
        d="M 7.5 2 Q 7.5 4.5 5 4.5 Q 7.5 4.5 7.5 7 Q 7.5 4.5 10 4.5 Q 7.5 4.5 7.5 2 Z"
        className="wand-sparkle wand-sparkle-2"
        style={{ fill: "currentColor", stroke: "none" }}
      />

      {/* Sparkle 3 (Small 4-pointed star) */}
      <path
        d="M 17 9.5 Q 17 11.5 15 11.5 Q 17 11.5 17 13.5 Q 17 11.5 19 11.5 Q 17 11.5 17 9.5 Z"
        className="wand-sparkle wand-sparkle-3"
        style={{ fill: "currentColor", stroke: "none" }}
      />

      {/* Fairy dust dot 1 */}
      <circle
        cx="11.5"
        cy="3.5"
        r="0.6"
        className="wand-sparkle wand-sparkle-dot-1"
        style={{ fill: "currentColor", stroke: "none" }}
      />

      {/* Fairy dust dot 2 */}
      <circle
        cx="14.5"
        cy="11"
        r="0.5"
        className="wand-sparkle wand-sparkle-dot-2"
        style={{ fill: "currentColor", stroke: "none" }}
      />
    </svg>
  );
}
