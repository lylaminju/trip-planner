import { SERVICE_TITLE } from "@/lib/service-brand";

import { ACCESS_EMAIL, requestAccessHref } from "./access";
import { SampleTripPreview } from "./SampleTripPreview";

export function LandingHero() {
  return (
    <>
      <header className="landing-header">
        <a
          className="landing-brand"
          href="#top"
          aria-label={`${SERVICE_TITLE} home`}
        >
          {SERVICE_TITLE}
        </a>
        <nav className="landing-nav" aria-label="Landing page">
          <a href={requestAccessHref}>Request invite</a>
          <a href="#sign-in">Sign in</a>
        </nav>
      </header>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <h1>
            Trip planning,
            <span>at a glance.</span>
          </h1>
          <div className="landing-hero-support">
            <p className="landing-hero-description">
              Plan the itinerary and map the route <br /> in one view.
            </p>
            <div className="landing-hero-actions">
              <a className="landing-primary-action" href={requestAccessHref}>
                Request invite
              </a>
              <a className="landing-secondary-action" href="#sign-in">
                Already invited? Sign in
              </a>
            </div>
            <p className="landing-access-copy">
              Email{" "}
              <a href={requestAccessHref}>
                {ACCESS_EMAIL}
              </a>{" "}
              directly if your email app does not open.
            </p>
          </div>
        </div>
        <SampleTripPreview />
      </section>
    </>
  );
}
