"use client";

import { useEffect, useRef, useState } from "react";

import { CloseIcon, MenuIcon } from "./Icons";

const MOBILE_NAV_DRAWER_ID = "trips-mobile-nav-drawer";

function TripGlanceServiceLogo() {
  return (
    <svg
      className="trips-service-logo"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        className="trips-service-logo-bg"
        width="64"
        height="64"
        rx="14"
      />
      <path
        className="trips-service-logo-map"
        d="M14 24L26 18L38 24L50 18V48L38 54L26 48L14 54V24Z"
      />
      <path className="trips-service-logo-map" d="M26 18V48M38 24V54" />
    </svg>
  );
}

export function TripsDashboardRail(props: {
  displayName: string;
  userEmail?: string;
  onLogout: () => void;
  isAdmin?: boolean;
}) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const railClasses = [
    "trips-brand-rail",
    isMobileNavOpen ? "trips-brand-rail-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    if (!isMobileNavOpen) return;

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileNavOpen]);

  function closeMobileNav() {
    setIsMobileNavOpen(false);
  }

  function logout() {
    closeMobileNav();
    props.onLogout();
  }

  return (
    <>
      <div className="trips-mobile-topbar">
        <div className="trips-mobile-service-mark">
          <TripGlanceServiceLogo />
          <span>TripGlance</span>
        </div>
        <button
          type="button"
          className="icon-button trips-mobile-nav-toggle"
          aria-controls={MOBILE_NAV_DRAWER_ID}
          aria-expanded={isMobileNavOpen}
          aria-label={
            isMobileNavOpen ? "Close navigation menu" : "Open navigation menu"
          }
          onClick={() => setIsMobileNavOpen((current) => !current)}
        >
          <MenuIcon />
        </button>
      </div>

      <button
        type="button"
        className="trips-mobile-nav-backdrop"
        aria-label="Close navigation menu"
        hidden={!isMobileNavOpen}
        onClick={closeMobileNav}
      />

      <aside id={MOBILE_NAV_DRAWER_ID} className={railClasses}>
        <div className="trips-brand-rail-header">
          <div className="trips-service-mark">
            <TripGlanceServiceLogo />
            <span>TripGlance</span>
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            className="icon-button trips-mobile-nav-close"
            aria-label="Close navigation menu"
            onClick={closeMobileNav}
          >
            <CloseIcon />
          </button>
        </div>

        <section className="trips-profile-card" aria-label="Signed in as">
          <div className="trips-avatar" aria-hidden="true">
            {props.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="trips-profile-copy">
            <strong>{props.displayName}</strong>
            {props.userEmail && <span>{props.userEmail}</span>}
          </div>
        </section>

        {props.isAdmin && (
          <nav className="trips-rail-nav">
            <a href="/dashboard" className="trips-rail-nav-button">
              Dashboard
            </a>
          </nav>
        )}

        <div className="trips-account-actions">
          <button type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
