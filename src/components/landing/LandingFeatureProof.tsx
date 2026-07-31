import type { ReactNode } from "react";

import { UserPlusIcon } from "../Icons";
import { requestAccessHref } from "./access";

const FEATURE_CARDS = [
  {
    title: "Save any place",
    body: "Search Google Maps from the planner, or paste a Maps link, and the place lands in your trip with its photo and details.",
    icon: <PlaceSearchIcon />,
    tone: "maps outline",
  },
  {
    title: "Share the trip",
    body: "Invite travel companions by email as an owner who can edit, or a viewer who just follows along.",
    icon: <UserPlusIcon />,
    tone: "share outline",
  },
  {
    title: "All your trips",
    body: "Upcoming and past trips stay grouped on one dashboard, and trips without dates stay visible until you set them.",
    icon: <CalendarGridIcon />,
    tone: "accent",
  },
] satisfies Array<{
  title: string;
  body: string;
  icon: ReactNode;
  tone: string;
}>;

export function LandingFeatureProof() {
  return (
    <>
      <section
        className="landing-feature-section"
        id="features"
        aria-labelledby="landing-features-title"
      >
        <div className="landing-section-heading">
          <p className="landing-section-label">Beyond the itinerary</p>
          <h2 id="landing-features-title">
            Add places, invite companions,
            <br />
            keep every trip together.
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
        className="landing-final-cta-wrap"
        aria-labelledby="landing-cta-title"
      >
        <div className="landing-final-cta">
          <h2 id="landing-cta-title">Ready to plan your next trip?</h2>
          <div className="landing-hero-actions">
            <a className="landing-primary-action" href={requestAccessHref}>
              Email for an invite
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

function PlaceSearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="8.75" cy="8.75" r="5.25" />
      <path d="M12.6 12.6 16.5 16.5" />
    </svg>
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
