import { guestSessionSecret } from "@/server/guest-session";
import { hasSampleTrip } from "@/server/guest-trip-service";

import { requestAccessHref } from "./access";
import { MarketingHeader } from "./MarketingHeader";
import { SampleTripCta } from "./SampleTripCta";

export function LandingHero() {
  // Guest CTAs only render while guest mode is configured; without the
  // signing secret the landing keeps its invite-only layout.
  const guestModeEnabled = guestSessionSecret() !== null;
  const sampleTripEnabled = guestModeEnabled && hasSampleTrip();

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
            {sampleTripEnabled ? (
              <SampleTripCta />
            ) : guestModeEnabled ? (
              <a className="landing-primary-action" href="/try">
                Try the demo — no sign-up
              </a>
            ) : (
              <a className="landing-primary-action" href={requestAccessHref}>
                Request invite
              </a>
            )}
            {sampleTripEnabled ? (
              <a className="landing-secondary-action" href="/try">
                Plan your own trip
              </a>
            ) : (
              <a className="landing-secondary-action" href="#showcase">
                See how it works
              </a>
            )}
          </div>
          <p className="landing-access-copy">
            {guestModeEnabled ? (
              <>
                Free demo, no sign-up — demo trips expire after 48 hours.{" "}
                <a href={requestAccessHref}>Request an invite</a> for full
                access, or <a href="/sign-in">sign in</a>
              </>
            ) : (
              <>
                Invite-only beta · Existing users can{" "}
                <a href="/sign-in">sign in</a>
              </>
            )}
          </p>
        </div>
      </section>
    </>
  );
}
