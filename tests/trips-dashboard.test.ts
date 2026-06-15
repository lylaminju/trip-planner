import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { TripSection, TripsDashboard } from "@/components/TripsDashboard";

describe("TripsDashboard", () => {
  it("renders the shell with profile fallback and log-out control", () => {
    const markup = renderToStaticMarkup(createElement(TripsDashboard));

    expect(markup).toContain('class="trips-dashboard-shell"');
    expect(markup).toContain("Hi, Traveler!");
    expect(markup).toContain('class="trips-brand-rail"');
    expect(markup).toContain("Log out");
    expect(markup).not.toContain("Total trips");
    expect(markup).toContain('type="button" class="trip-form-clear"');
    expect(markup).toContain('class="destination-combobox"');
    expect(markup).toContain('placeholder="Search or type destination"');
    expect(markup).toContain("Clear");
    expect(markup).toContain("Create trip");
    expect(markup.indexOf("Create trip")).toBeLessThan(markup.indexOf("Clear"));
  });

  it("renders empty trip sections as bucket-sized placeholders", () => {
    const markup = renderToStaticMarkup(
      createElement(TripSection, {
        title: "Past Trips",
        trips: [],
        editing: null,
        isSaving: false,
        deletingTripIds: new Set<number>(),
        timeZoneOptions: [],
        onEditStart: vi.fn(),
        onEditCancel: vi.fn(),
        onEditChange: vi.fn(),
        onEditSubmit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(markup).toContain('class="trip-empty-bucket"');
    expect(markup).toContain("0 trips");
    expect(markup).toContain('aria-label="No trips in this section."');
    expect(markup).toContain('viewBox="0 0 64 64"');
    expect(markup).not.toContain(
      '<p class="trip-empty-text">No trips in this section.</p>',
    );
  });

  it("sizes the destination dropdown to the input field", () => {
    const css = readFileSync(
      "src/styles/components/trips-dashboard.css",
      "utf8",
    );

    expect(css).toMatch(
      /(?:^|\n)\.destination-combobox-popover\s*{[^}]*left:\s*0;[^}]*right:\s*0;[^}]*width:\s*auto;/s,
    );
  });
});
