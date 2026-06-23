import { requestAccessHref } from "./access";
import { MarketingHeader } from "./MarketingHeader";

export function LandingHero() {
  return (
    <>
      <MarketingHeader context="landing" />

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <h1>
            Trip planning,{" "}
            <span>at a glance.</span>
          </h1>
          <p className="landing-hero-description">
            Build each travel day beside the map, with timed stops, route
            segments, and travel modes in one clear itinerary view.
          </p>
          <div className="landing-hero-actions">
            <a className="landing-primary-action" href={requestAccessHref}>
              Request invite
            </a>
            <a className="landing-secondary-action" href="#showcase">
              See how it works
            </a>
          </div>
          <p className="landing-access-copy">
            Invite-only beta · Existing users can{" "}
            <a href="/sign-in">sign in</a>
          </p>
        </div>
      </section>
    </>
  );
}
