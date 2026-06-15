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

  it("converts the selected trip into an edit card without the legacy edit row", () => {
    const trip = tripSummary();
    const markup = renderToStaticMarkup(
      createElement(TripSection, {
        title: "Ongoing & Upcoming",
        trips: [trip],
        featuredTripId: trip.id,
        editing: {
          tripId: trip.id,
          form: {
            name: trip.name,
            destination: trip.destination ?? "",
            startDate: trip.start_date ?? "",
            endDate: trip.end_date ?? "",
            timezone: trip.timezone,
          },
        },
        isSaving: false,
        deletingTripIds: new Set<number>(),
        onEditStart: vi.fn(),
        onEditCancel: vi.fn(),
        onEditChange: vi.fn(),
        onEditSubmit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(markup).toContain('class="trip-row featured-trip trip-row-editing"');
    expect(markup).toContain("/city-covers/toronto.webp");
    expect(markup).toContain('value="Toronto June"');
    expect(markup).toContain('value="2026-06-01"');
    expect(markup).toContain("Save changes");
    expect(markup).toContain("Cancel");
    expect(markup).not.toContain('class="trip-row trip-edit-form"');
    expect(markup).not.toContain(">Edit trip<");
    expect(markup).not.toContain('aria-label="Timezone"');
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

  it("keeps the create trip hover state styled as a primary action", () => {
    const css = readFileSync(
      "src/styles/components/trips-dashboard.css",
      "utf8",
    );

    expect(css).toMatch(
      /(?:^|\n)\.trip-form-submit:hover:not\(:disabled\)\s*{[^}]*background:\s*var\(--accent-hover\);[^}]*border-color:\s*var\(--accent-hover\);[^}]*color:\s*var\(--text-on-accent\);/s,
    );
  });

  it("increases desktop trip card text without resizing chips or icon buttons", () => {
    const css = readFileSync(
      "src/styles/components/trips-dashboard.css",
      "utf8",
    );

    expect(css).toMatch(
      /@media \(min-width: 921px\)\s*{[\s\S]*\.trip-row-main strong\s*{[^}]*font-size:\s*17px;/,
    );
    expect(css).toMatch(
      /@media \(min-width: 921px\)\s*{[\s\S]*\.trip-row-main \.trip-destination,\s*\.trip-row-main \.trip-period\s*{[^}]*font-size:\s*14px;/,
    );
    expect(css).not.toMatch(
      /@media \(min-width: 921px\)\s*{[^}]*\.(?:trip-duration|trip-role|icon-button)\s*{[^}]*font-size:/s,
    );
  });
});

function tripSummary() {
  return {
    id: 12,
    created_by: "user-1",
    name: "Toronto June",
    destination: "Toronto",
    start_date: "2026-06-01",
    end_date: "2026-06-02",
    timezone: "America/Toronto",
    role: "owner" as const,
    created_at: "2026-05-20 00:00:00",
    updated_at: "2026-05-20 00:00:00",
  };
}
