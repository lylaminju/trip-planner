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
      <rect className="trips-service-logo-bg" width="64" height="64" rx="14" />
      <path
        className="trips-service-logo-map"
        d="M14 24L26 18L38 24L50 18V48L38 54L26 48L14 54V24Z"
      />
      <path className="trips-service-logo-map" d="M26 18V48M38 24V54" />
    </svg>
  );
}

function RailTripsIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M2.5 4.8l3.6-1.8 3.8 1.8 3.6-1.8v8.2l-3.6 1.8-3.8-1.8-3.6 1.8V4.8z" />
      <path d="M6.1 3v8.2M9.9 4.8V13" />
    </svg>
  );
}

function RailFriendsIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="6" cy="5.5" r="2.4" />
      <path d="M1.8 13.5c0-2.3 1.9-3.8 4.2-3.8s4.2 1.5 4.2 3.8" />
      <path d="M10.6 3.4a2.4 2.4 0 110 4.3M11.6 9.9c1.6.4 2.7 1.7 2.7 3.6" />
    </svg>
  );
}

function RailSettingsIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M2 4.5h12M2 8h12M2 11.5h12" />
      <circle cx="10.5" cy="4.5" r="1.7" />
      <circle cx="5.5" cy="8" r="1.7" />
      <circle cx="9" cy="11.5" r="1.7" />
    </svg>
  );
}

function RailDashboardIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="5" height="5" rx="1.2" />
      <rect x="9" y="2" width="5" height="5" rx="1.2" />
      <rect x="2" y="9" width="5" height="5" rx="1.2" />
      <rect x="9" y="9" width="5" height="5" rx="1.2" />
    </svg>
  );
}

function RailLogoutIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M6.5 2H3.5v12h3M10.5 5l3 3-3 3M13 8H6.5" />
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

        <nav className="trips-rail-nav" aria-label="Primary">
          <a
            href="/trips"
            className="trips-rail-nav-item trips-rail-nav-item-active"
            aria-current="page"
          >
            <span className="trips-rail-nav-icon" aria-hidden="true">
              <RailTripsIcon />
            </span>
            <span className="trips-rail-nav-label">Trips</span>
          </a>
          <span
            className="trips-rail-nav-item trips-rail-nav-item-disabled"
            aria-disabled="true"
            title="Coming soon"
          >
            <span className="trips-rail-nav-icon" aria-hidden="true">
              <RailFriendsIcon />
            </span>
            <span className="trips-rail-nav-label">Friends</span>
            <span className="trips-rail-nav-soon">Soon</span>
          </span>
          <span
            className="trips-rail-nav-item trips-rail-nav-item-disabled"
            aria-disabled="true"
            title="Coming soon"
          >
            <span className="trips-rail-nav-icon" aria-hidden="true">
              <RailSettingsIcon />
            </span>
            <span className="trips-rail-nav-label">Settings</span>
            <span className="trips-rail-nav-soon">Soon</span>
          </span>

          {props.isAdmin && (
            <>
              <span className="trips-rail-nav-divider" aria-hidden="true" />
              <a href="/dashboard" className="trips-rail-nav-item">
                <span className="trips-rail-nav-icon" aria-hidden="true">
                  <RailDashboardIcon />
                </span>
                <span className="trips-rail-nav-label">Dashboard</span>
                <span className="trips-rail-nav-badge">Admin</span>
              </a>
            </>
          )}
        </nav>

        <div className="trips-rail-footer">
          <div className="trips-profile-card" aria-label="Signed in as">
            <div className="trips-avatar" aria-hidden="true">
              {props.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="trips-profile-copy">
              <strong>{props.displayName}</strong>
              {props.userEmail && <span>{props.userEmail}</span>}
            </div>
            <button
              type="button"
              className="icon-button trips-logout-button"
              aria-label="Log out"
              title="Log out"
              onClick={logout}
            >
              <RailLogoutIcon />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
