import { SampleTripPreview } from "./SampleTripPreview";

const ACCESS_EMAIL = "mjuudev@gmail.com";
const ACCESS_SUBJECT = "Trip Planner access request";
const ACCESS_BODY = "Hi, I would like to request access to Trip Planner.";

export const requestAccessHref = `mailto:${ACCESS_EMAIL}?subject=${encodeURIComponent(
  ACCESS_SUBJECT,
)}&body=${encodeURIComponent(
  ACCESS_BODY,
)}`;

export function LandingHero() {
  return (
    <>
      <header className="landing-header">
        <a className="landing-brand" href="#top" aria-label="Trip Planner home">
          Trip Planner
        </a>
        <nav className="landing-nav" aria-label="Landing page">
          <a href="#sample-trip">Sample trip</a>
          <a href="#sign-in">Sign in</a>
        </nav>
      </header>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <h1>See the itinerary and the route at the same time.</h1>
          <p>
            Build each day from saved places, then check the map before the plan
            gets messy.
          </p>
          <div className="landing-hero-actions">
            <a className="landing-primary-action" href={requestAccessHref}>
              Request access
            </a>
            <a className="landing-secondary-action" href="#sample-trip">
              View sample trip
            </a>
          </div>
          <p className="landing-access-copy">
            Invite-only while accounts are manually created.
          </p>
        </div>
        <SampleTripPreview />
      </section>
    </>
  );
}
