import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { CreateTripModal } from "@/components/CreateTripModal";
import { TripSection, TripsDashboard } from "@/components/TripsDashboard";

describe("TripsDashboard", () => {
  it("renders the shell with profile fallback, left-rail account controls, and header create action", () => {
    const markup = renderToStaticMarkup(createElement(TripsDashboard));

    expect(markup).toContain('class="trips-dashboard-shell"');
    expect(markup).toContain("Hi, Traveler!");
    expect(markup).toContain('class="trips-brand-rail"');
    expect(markup).toContain('class="trips-profile-card"');
    expect(markup).toContain('class="trips-account-actions"');
    expect(markup).toContain("Log out");
    expect(markup.indexOf('class="trips-service-mark"')).toBeLessThan(
      markup.indexOf('class="trips-profile-card"'),
    );
    expect(markup.indexOf('class="trips-profile-card"')).toBeLessThan(
      markup.indexOf('class="trips-account-actions"'),
    );
    expect(markup).toContain('class="trips-header-actions"');
    expect(markup).toContain('class="trip-create-trigger"');
    expect(markup).toContain("+ New Trip");
    expect(markup).not.toContain('class="trips-side-rail"');
    expect(markup).not.toContain('class="trip-create-card"');
    expect(markup).not.toContain("Total trips");
  });

  it("renders the create trip form as a modal dialog", () => {
    const markup = renderToStaticMarkup(
      createElement(CreateTripModal, {
        form: {
          name: "",
          destination: "",
          startDate: "",
          endDate: "",
          timezone: "America/Toronto",
        },
        coverImage: "/city-covers/toronto.webp",
        error: null,
        isSaving: false,
        onCancel: vi.fn(),
        onChange: vi.fn(),
        onSubmit: vi.fn(),
      }),
    );

    expect(markup).toContain(
      'class="modal-backdrop trip-create-modal-backdrop"',
    );
    expect(markup).toContain('class="modal trip-create-modal"');
    expect(markup).toContain("Create trip");
    expect(markup).toContain('class="destination-combobox"');
    expect(markup).toContain('placeholder="Search or type destination"');
    expect(markup).toContain('class="trip-form-cover"');
    expect(markup).toContain('class="trip-date-range-picker"');
    expect(markup).toContain("Add dates");
    expect(markup).not.toContain('type="date"');
    expect(markup).not.toContain('class="trip-form-date-row"');
    expect(markup).not.toContain("Timezone");
    expect(markup).not.toContain('class="timezone-select"');
    expect(markup).toContain("Cancel");
    expect(markup.indexOf("Cancel")).toBeLessThan(
      markup.lastIndexOf("Create trip"),
    );
  });

  it("renders empty trip sections as bucket-sized placeholders", () => {
    const markup = renderToStaticMarkup(
      createElement(TripSection, {
        sectionId: "past-trips",
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

    expect(markup).toContain('class="trip-section-collapse-button"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-controls="past-trips-panel"');
    expect(markup).toContain('aria-label="Collapse Past Trips"');
    expect(markup.indexOf('class="trip-section-collapse-button"')).toBeLessThan(
      markup.indexOf("<h2>Past Trips</h2>"),
    );
    expect(
      markupBetween(markup, "trip-section-collapse-button", "button"),
    ).toContain("<svg");
    expect(markup).toContain('class="trip-empty-bucket"');
    expect(markup).toContain("0 trips");
    expect(markup).toContain('aria-label="No trips in this section."');
    expect(markup).toContain('viewBox="0 0 64 64"');
    expect(markup).not.toContain(
      '<p class="trip-empty-text">No trips in this section.</p>',
    );
  });

  it("hides a collapsed trip section body while preserving the heading count", () => {
    const markup = renderToStaticMarkup(
      createElement(TripSection, {
        sectionId: "past-trips",
        title: "Past Trips",
        trips: [tripSummary()],
        isOpen: false,
        editing: null,
        isSaving: false,
        deletingTripIds: new Set<number>(),
        onEditStart: vi.fn(),
        onEditCancel: vi.fn(),
        onEditChange: vi.fn(),
        onEditSubmit: vi.fn(),
        onDelete: vi.fn(),
        onToggleOpen: vi.fn(),
      }),
    );

    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-label="Expand Past Trips"');
    expect(markup).toContain("1 trip");
    expect(markup).toContain('id="past-trips-panel" hidden=""');
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
      "src/styles/components/trips-dashboard-shell.css",
      "utf8",
    );

    expect(css).toMatch(
      /(?:^|\n)\.trip-form-submit:hover:not\(:disabled\)\s*{[^}]*background:\s*var\(--accent-hover\);[^}]*border-color:\s*var\(--accent-hover\);[^}]*color:\s*var\(--text-on-accent\);/s,
    );
  });

  it("keeps the profile card directly below the service title", () => {
    const css = readFileSync(
      "src/styles/components/trips-dashboard-shell.css",
      "utf8",
    );
    const profileRule = cssRule(css, ".trips-profile-card");
    const accountActionsRule = cssRule(css, ".trips-account-actions");

    expect(profileRule).not.toContain("margin-top: auto;");
    expect(accountActionsRule).toContain("margin-top: auto;");
  });

  it("renders the trip date calendar as a viewport-fixed popover", () => {
    const css = readFileSync(
      "src/styles/components/trip-date-range-picker.css",
      "utf8",
    );
    const calendarRule = cssRule(css, ".trip-date-calendar");

    expect(calendarRule).toContain("left: 50%;");
    expect(calendarRule).toContain("max-height: calc(100dvh - 32px);");
    expect(calendarRule).toContain("overflow: auto;");
    expect(calendarRule).toContain("position: fixed;");
    expect(calendarRule).toContain("top: 50%;");
    expect(calendarRule).toContain("transform: translate(-50%, -50%);");
    expect(calendarRule).toContain("z-index: 22;");
  });

  it("keeps calendar day rows aligned across months", () => {
    const css = readFileSync(
      "src/styles/components/trip-date-range-picker.css",
      "utf8",
    );
    const gridRule = cssRule(css, ".trip-date-calendar-grid");

    expect(gridRule).toContain("grid-auto-rows: 34px;");
    expect(gridRule).toContain("align-items: stretch;");
  });

  it("uses fixed month and year selects in the date calendar header", () => {
    const source = readFileSync(
      "src/components/TripDateRangePicker.tsx",
      "utf8",
    );
    const css = readFileSync(
      "src/styles/components/trip-date-range-picker.css",
      "utf8",
    );

    expect(source).toContain('className="trip-date-nav-button"');
    expect(source).toContain('className="trip-date-calendar-selects"');
    expect(source).toContain('className="trip-date-month-select"');
    expect(source).toContain('className="trip-date-year-select"');
    expect(source).toContain('aria-label="Visible month"');
    expect(source).toContain('aria-label="Visible year"');
    expect(source).toContain("This month");
    expect(source).not.toContain("isMonthPickerOpen");
    expect(source).not.toContain("trip-date-month-jump-panel");
    expect(source).not.toContain("trip-date-month-option");
    expect(source).not.toContain(">Prev<");
    expect(source).not.toContain(">Next<");

    expect(cssRule(css, ".trip-date-calendar-header")).toContain(
      "grid-template-columns: 34px minmax(0, 1fr) 34px;",
    );
    const selectGroupRule = cssRule(css, ".trip-date-calendar-selects");
    expect(selectGroupRule).toContain("grid-template-columns: max-content max-content;");
    expect(selectGroupRule).toContain("justify-self: center;");

    expect(css).toMatch(
      /\.trip-date-month-select,\s*\.trip-date-year-select\s*{[^}]*height:\s*34px;[^}]*width:\s*fit-content;/s,
    );
    expect(css).not.toMatch(
      /\.trip-date-month-select,\s*\.trip-date-year-select\s*{[^}]*width:\s*100%;/s,
    );
  });

  it("uses the planner collapse button shape for trip section headings", () => {
    const css = readFileSync(
      "src/styles/components/trips-dashboard.css",
      "utf8",
    );
    const rule = cssRule(css, ".trip-section-collapse-button");

    expect(rule).toContain("background: transparent;");
    expect(rule).toContain("border: 0;");
    expect(rule).toContain("border-radius: 6px;");
    expect(rule).toContain("flex: 0 0 28px;");
    expect(rule).toContain("height: 28px;");
    expect(rule).toContain("width: 28px;");
  });

  it("keeps desktop trip grid rows at a consistent height", () => {
    const css = readFileSync(
      "src/styles/components/trips-dashboard.css",
      "utf8",
    );

    expect(css).toMatch(
      /@media \(min-width: 921px\)\s*{[\s\S]*\.trip-list\s*{[^}]*--trip-card-desktop-height:\s*306\.5px;[^}]*grid-auto-rows:\s*var\(--trip-card-desktop-height\);/s,
    );
    expect(css).toMatch(
      /@media \(min-width: 921px\)\s*{[\s\S]*\.trip-list > \.trip-row\s*{[^}]*align-self:\s*stretch;[^}]*height:\s*100%;[^}]*min-height:\s*0;/s,
    );
    expect(css).toMatch(
      /@media \(min-width: 921px\)\s*{[\s\S]*\.trip-row-editing:not\(\.featured-trip\)\s*{[^}]*padding-bottom:\s*10px;/s,
    );
    expect(css).toMatch(
      /@media \(min-width: 921px\)\s*{[\s\S]*\.trip-row-editing\.featured-trip\s*{[^}]*padding-bottom:\s*0;/s,
    );
    expect(css).toMatch(
      /\.trip-row:not\(\.featured-trip\):not\(\.trip-row-editing\)\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s,
    );
    expect(css).toMatch(
      /\.trip-row:not\(\.featured-trip\):not\(\.trip-row-editing\) \.trip-row-meta\s*{[^}]*bottom:\s*10px;[^}]*position:\s*absolute;[^}]*right:\s*8px;/s,
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

function markupBetween(markup: string, className: string, tag: string) {
  const start = markup.indexOf(`class="${className}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const elementStart = markup.lastIndexOf(`<${tag}`, start);
  const elementEnd = markup.indexOf(`</${tag}>`, start);
  expect(elementStart).toBeGreaterThanOrEqual(0);
  expect(elementEnd).toBeGreaterThanOrEqual(0);

  return markup.slice(elementStart, elementEnd + tag.length + 3);
}

function cssRule(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n}", start);
  expect(end).toBeGreaterThanOrEqual(0);

  return css.slice(start, end + 2);
}
