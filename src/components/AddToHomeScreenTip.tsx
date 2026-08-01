"use client";

import { useEffect, useState } from "react";

import { CloseIcon, ShareIcon } from "@/components/Icons";
import {
  INSTALL_TIP_INSTALLED_KEY,
  INSTALL_TIP_SNOOZED_AT_KEY,
  shouldShowInstallTip,
} from "@/lib/home-screen-install";
import { SERVICE_TITLE } from "@/lib/service-brand";

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private browsing can block storage; fall back to showing the tip.
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage is unavailable, so this choice will not outlive the session.
  }
}

function readSnoozedAt(): number | null {
  const raw = readStored(INSTALL_TIP_SNOOZED_AT_KEY);
  if (raw === null) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  // A corrupt value simply offers the tip again rather than hiding it forever.
  return Number.isFinite(parsed) ? parsed : null;
}

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari shipped this flag long before it supported the display-mode query.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

/**
 * iOS has no install prompt event, so the home-screen flow has to be spelled
 * out. Renders nothing unless the visitor is on iOS Safari in a normal tab.
 */
export function AddToHomeScreenTip() {
  const [isVisible, setIsVisible] = useState(false);

  // Deferred to an effect because every input is browser-only; server markup
  // stays empty so the two renders agree.
  useEffect(() => {
    setIsVisible(
      shouldShowInstallTip({
        userAgent: window.navigator.userAgent,
        isStandalone: isStandaloneDisplay(),
        hasConfirmedInstall:
          readStored(INSTALL_TIP_INSTALLED_KEY) === "true",
        snoozedAt: readSnoozedAt(),
        now: Date.now(),
      }),
    );
  }, []);

  if (!isVisible) {
    return null;
  }

  function snooze() {
    writeStored(INSTALL_TIP_SNOOZED_AT_KEY, String(Date.now()));
    setIsVisible(false);
  }

  function confirmInstalled() {
    writeStored(INSTALL_TIP_INSTALLED_KEY, "true");
    setIsVisible(false);
  }

  return (
    <aside className="install-tip" aria-labelledby="install-tip-title">
      <div className="install-tip-copy">
        <p className="install-tip-title" id="install-tip-title">
          Use {SERVICE_TITLE} like an app
        </p>
        <ol className="install-tip-steps">
          <li className="install-tip-step">
            Tap{" "}
            <span className="install-tip-share-icon" aria-hidden="true">
              <ShareIcon />
            </span>
            <strong className="install-tip-step-action">Share</strong>{" "}
            in the Safari toolbar
          </li>
          <li className="install-tip-step">
            Choose{" "}
            <strong className="install-tip-step-action">
              Add to Home Screen
            </strong>
          </li>
        </ol>
        <p className="install-tip-note">
          It opens full screen, without the browser bars. You will sign in once
          more inside the app.
        </p>
        <button
          type="button"
          className="install-tip-confirm"
          onClick={confirmInstalled}
        >
          I already installed it
        </button>
      </div>
      <button
        type="button"
        className="install-tip-dismiss"
        onClick={snooze}
        aria-label="Hide home screen tip for now"
      >
        <CloseIcon />
      </button>
    </aside>
  );
}
