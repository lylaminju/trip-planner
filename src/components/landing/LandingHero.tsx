import { SampleTripPreview } from "./SampleTripPreview";

export const ACCESS_EMAIL = "mjuudev@gmail.com";
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
          <a href="#sign-in">Sign in</a>
        </nav>
      </header>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <h1>Trip Planner</h1>
          <div className="landing-hero-support">
            <p>See the itinerary and the route at the same time.</p>
            <div className="landing-primary-action-group">
              <a className="landing-primary-action" href={requestAccessHref}>
                Request access
              </a>
              <p className="landing-access-copy">
                Opens your email app to request an invite.
              </p>
            </div>
          </div>
        </div>
        <SampleTripPreview />
      </section>
    </>
  );
}
