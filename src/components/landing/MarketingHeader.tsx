import { requestAccessHref } from "./access";
import { TripGlanceLogo } from "./TripGlanceLogo";

type MarketingHeaderProps = {
  context: "landing" | "sign-in";
};

export function MarketingHeader({ context }: MarketingHeaderProps) {
  const isLanding = context === "landing";

  return (
    <header className="marketing-header">
      <div className="marketing-header-inner">
        <a className="marketing-brand" href={isLanding ? "#top" : "/"}>
          <TripGlanceLogo />
        </a>
        <nav className="marketing-nav" aria-label="Primary">
          {isLanding ? (
            <>
              <a className="marketing-nav-link" href="#ai-planner">
                AI planner
              </a>
              <a className="marketing-nav-link" href="#showcase">
                How it works
              </a>
              <a className="marketing-nav-link" href="#features">
                Features
              </a>
              <a className="marketing-nav-link" href="/sign-in">
                Sign in
              </a>
            </>
          ) : (
            <a className="marketing-nav-link" href="/">
              Overview
            </a>
          )}
          <a className="marketing-nav-cta" href={requestAccessHref}>
            Email for invite
          </a>
        </nav>
      </div>
    </header>
  );
}
