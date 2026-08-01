import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import {
  INSTALL_TIP_SNOOZE_MS,
  shouldShowInstallTip,
} from "@/lib/home-screen-install";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1";
const IPHONE_FIREFOX =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

const NOW = Date.parse("2026-08-01T00:00:00Z");

const NEVER_DISMISSED = {
  isStandalone: false,
  hasConfirmedInstall: false,
  snoozedAt: null,
  now: NOW,
};

describe("shouldShowInstallTip", () => {
  const cases: [label: string, userAgent: string, expected: boolean][] = [
    ["iPhone Safari can add to the home screen", IPHONE_SAFARI, true],
    ["Chrome on iOS uses a different flow", IPHONE_CHROME, false],
    ["Firefox on iOS uses a different flow", IPHONE_FIREFOX, false],
    ["Android gets a native install prompt", ANDROID_CHROME, false],
    ["desktop Safari has no home screen", MAC_SAFARI, false],
  ];

  it.each(cases)("%s", (_label, userAgent, expected) => {
    expect(shouldShowInstallTip({ ...NEVER_DISMISSED, userAgent })).toBe(
      expected,
    );
  });

  it("stays hidden while running from the home screen", () => {
    expect(
      shouldShowInstallTip({
        ...NEVER_DISMISSED,
        userAgent: IPHONE_SAFARI,
        isStandalone: true,
      }),
    ).toBe(false);
  });

  it("stays hidden forever once the visitor confirms they installed it", () => {
    // Safari cannot detect the install itself, so this answer has to persist
    // well past any snooze window.
    expect(
      shouldShowInstallTip({
        ...NEVER_DISMISSED,
        userAgent: IPHONE_SAFARI,
        hasConfirmedInstall: true,
        snoozedAt: NOW - INSTALL_TIP_SNOOZE_MS * 10,
      }),
    ).toBe(false);
  });

  it("hides for the snooze window after a dismiss", () => {
    expect(
      shouldShowInstallTip({
        ...NEVER_DISMISSED,
        userAgent: IPHONE_SAFARI,
        snoozedAt: NOW - INSTALL_TIP_SNOOZE_MS + 1,
      }),
    ).toBe(false);
  });

  it("returns once the snooze window has passed", () => {
    expect(
      shouldShowInstallTip({
        ...NEVER_DISMISSED,
        userAgent: IPHONE_SAFARI,
        snoozedAt: NOW - INSTALL_TIP_SNOOZE_MS,
      }),
    ).toBe(true);
  });
});

describe("web app manifest", () => {
  it("declares the standalone display iOS needs to drop the browser bars", () => {
    expect(manifest().display).toBe("standalone");
  });

  it("ships every declared icon so the home screen icon cannot silently break", () => {
    const icons = manifest().icons ?? [];

    expect(icons.map((icon) => icon.sizes)).toContain("192x192");
    expect(icons.map((icon) => icon.sizes)).toContain("512x512");
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);

    for (const icon of icons) {
      const iconPath = path.join(process.cwd(), "public", icon.src);
      expect(fs.existsSync(iconPath), `missing ${icon.src}`).toBe(true);
    }
  });

  it("keeps the apple-touch-icon Next.js derives the iOS icon from", () => {
    // iOS ignores src/app/icon.svg for the home screen and needs this PNG.
    const appleIcon = path.join(process.cwd(), "src", "app", "apple-icon.png");

    expect(fs.existsSync(appleIcon)).toBe(true);
  });
});
