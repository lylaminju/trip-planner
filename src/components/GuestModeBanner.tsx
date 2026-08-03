"use client";

import { requestAccessHref } from "@/components/landing/access";
import { sendGuestEvent } from "@/lib/guest-api";

export function GuestModeBanner() {
  return (
    <div className="guest-mode-banner" role="note">
      <p className="guest-mode-banner-line">
        Guest mode — this demo trip expires after 48 hours.
      </p>
      <p className="guest-mode-banner-line">
        Have an account?{" "}
        <a href="/sign-in" onClick={() => sendGuestEvent("upsell_clicked")}>
          Sign in
        </a>
        .
      </p>
      <p className="guest-mode-banner-line">
        Want full access?{" "}
        <a
          href={requestAccessHref}
          onClick={() => sendGuestEvent("upsell_clicked")}
        >
          Email us for an invite
        </a>
        .
      </p>
    </div>
  );
}
