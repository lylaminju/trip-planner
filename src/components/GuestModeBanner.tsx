"use client";

import { useEffect } from "react";

import { sendGuestEvent } from "@/lib/guest-api";

export function GuestModeBanner() {
  // One impression beacon per planner mount; failures are ignored.
  useEffect(() => {
    sendGuestEvent("upsell_shown");
  }, []);

  return (
    <div className="guest-mode-banner" role="note">
      <span>
        Guest mode — this demo trip expires after 48 hours.{" "}
        <a href="/" onClick={() => sendGuestEvent("upsell_clicked")}>
          Request an invite
        </a>{" "}
        to keep trips, use Google search, and unlock AI web verification.
      </span>
    </div>
  );
}
