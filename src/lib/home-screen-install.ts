/**
 * Home-screen install support.
 *
 * iOS never fires an install prompt event, so the "Add to Home Screen" flow has
 * to be explained in the UI. These helpers decide when that explanation is
 * still worth showing.
 */

const IOS_DEVICE_PATTERN = /iPhone|iPad|iPod/;

/**
 * Every iOS browser renders with WebKit, but only Safari exposes the share
 * sheet the instructions describe, so the other wrappers are excluded.
 */
const NON_SAFARI_IOS_BROWSER_PATTERN = /CriOS|FxiOS|EdgiOS|OPiOS|GSA/;

/**
 * Safari cannot see that a site was added to the home screen — `display-mode`
 * only reports standalone inside the installed app, never in the tab the tip
 * renders in. So the visitor confirms it themselves, and that answer sticks.
 */
export const INSTALL_TIP_INSTALLED_KEY = "tripglance.install-tip-installed";

/** Epoch milliseconds of the last dismiss, which only hides the tip for a while. */
export const INSTALL_TIP_SNOOZED_AT_KEY = "tripglance.install-tip-snoozed-at";

export const INSTALL_TIP_SNOOZE_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const INSTALL_TIP_SNOOZE_MS = INSTALL_TIP_SNOOZE_DAYS * MS_PER_DAY;

export type InstallTipContext = {
  userAgent: string;
  /** True once the page is running from the home screen instead of a tab. */
  isStandalone: boolean;
  /** Set by the "I already installed it" control; never expires. */
  hasConfirmedInstall: boolean;
  snoozedAt: number | null;
  now: number;
};

export function isIosSafari(userAgent: string): boolean {
  return (
    IOS_DEVICE_PATTERN.test(userAgent) &&
    !NON_SAFARI_IOS_BROWSER_PATTERN.test(userAgent)
  );
}

export function shouldShowInstallTip({
  userAgent,
  isStandalone,
  hasConfirmedInstall,
  snoozedAt,
  now,
}: InstallTipContext): boolean {
  if (isStandalone || hasConfirmedInstall) {
    return false;
  }

  if (snoozedAt !== null && now - snoozedAt < INSTALL_TIP_SNOOZE_MS) {
    return false;
  }

  return isIosSafari(userAgent);
}
