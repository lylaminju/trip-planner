import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { CreateTripModal } from "@/components/CreateTripModal";
import {
  defaultTripSectionOpenState,
  TripSection,
  TripsDashboard,
} from "@/components/TripsDashboard";
import { buildTripSummary } from "./helpers/fixtures";

describe("TripsDashboard", () => {
  it("renders the shell with a nav rail, pinned profile, and header create action", () => {
    const markup = renderToStaticMarkup(
      createElement(TripsDashboard, { userId: "user-1" }),
    );

    expect(markup).toContain('class="trips-dashboard-shell"');
    expect(markup).toContain("Hi, Traveler");
    expect(markup).toContain('class="trips-mobile-topbar"');
    expect(markup).toContain('class="trips-mobile-service-mark"');
    expect(markup.match(/class="trips-service-logo"/g)?.length ?? 0).toBe(2);
    expect(markup).toContain('aria-hidden="true" focusable="false"');
    expect(markup).toContain('aria-controls="trips-mobile-nav-drawer"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-label="Open navigation menu"');
    expect(markup).toContain('class="trips-mobile-nav-backdrop"');
    expect(markup).toContain('hidden=""');
    expect(markup).toContain('id="trips-mobile-nav-drawer"');
    expect(markup).toContain('class="icon-button trips-mobile-nav-close"');
    expect(markup).toContain('class="trips-brand-rail"');
    expect(markup).toContain('class="trips-rail-nav"');
    expect(markup).toContain("Trips");
    expect(markup).toContain("Friends");
    expect(markup).toContain("Settings");
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('class="trips-profile-card"');
    expect(markup).toContain('class="icon-button trips-logout-button"');
    expect(markup).toContain('aria-label="Log out"');
    expect(markup.indexOf('class="trips-service-mark"')).toBeLessThan(
      markup.indexOf('class="trips-rail-nav"'),
    );
    expect(markup.indexOf('class="trips-rail-nav"')).toBeLessThan(
      markup.indexOf('class="trips-profile-card"'),
    );
    expect(markup).toContain('class="trips-header-actions"');
    expect(markup).toContain('class="trip-create-trigger"');
    expect(markup).toContain("+ New Trip");
  });

  it("renders the create trip form as a modal dialog", () => {
    const markup = renderToStaticMarkup(
      createElement(CreateTripModal, {
        form: {
          name: "",
          destination: "",
          destinationSlug: null,
          startDate: "",
          endDate: "",
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
    expect(markup).toContain(
      'class="destination-combobox destination-combobox-has-icon"',
    );
    expect(markup).toContain('placeholder="Search or type destination"');
    expect(markup).toContain('aria-label="AI-planning available"');
    expect(markup).toContain('class="trip-create-hero"');
    expect(markup).toContain("Pick a destination to see it come alive");
    expect(markup).toContain('class="trip-date-range-picker"');
    expect(markup).toContain("Add your dates");
    expect(markup).not.toContain('type="date"');
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
        variant: "past",
        trips: [],
        editing: null,
        isSaving: false,
        deletingTripIds: new Set<number>(),
        currentUserId: "user-1",
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
    expect(markup).toContain("<span>0</span>");
    expect(markup).toContain('aria-label="No trips in this section."');
    expect(markup).toContain('viewBox="0 0 64 64"');
  });

  it("hides a collapsed trip section body while preserving the heading count", () => {
    const markup = renderToStaticMarkup(
      createElement(TripSection, {
        sectionId: "past-trips",
        title: "Past Trips",
        variant: "past",
        trips: [buildTripSummary()],
        isOpen: false,
        editing: null,
        isSaving: false,
        deletingTripIds: new Set<number>(),
        currentUserId: "user-1",
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
    expect(markup).toContain("<span>1</span>");
    expect(markup).toContain('id="past-trips-panel" hidden=""');
  });

  it("collapses past trips by default when the ongoing and upcoming section has trips", () => {
    const now = new Date("2026-06-21T12:00:00Z");

    expect(
      defaultTripSectionOpenState(
        [
          buildTripSummary({
            id: 12,
            start_date: "2026-07-01",
            end_date: "2026-07-02",
          }),
          buildTripSummary({
            id: 13,
            name: "Old Montreal",
            start_date: "2025-06-01",
            end_date: "2025-06-02",
          }),
        ],
        now,
      ),
    ).toEqual({
      active: true,
      past: false,
    });

    expect(
      defaultTripSectionOpenState(
        [
          buildTripSummary({
            id: 14,
            name: "Past only",
            start_date: "2025-07-01",
            end_date: "2025-07-02",
          }),
        ],
        now,
      ),
    ).toEqual({
      active: true,
      past: true,
    });
  });

  it("converts the selected trip into an inline edit card", () => {
    const trip = buildTripSummary();
    const markup = renderToStaticMarkup(
      createElement(TripSection, {
        title: "Upcoming",
        variant: "upcoming",
        trips: [trip],
        editing: {
          tripId: trip.id,
          form: {
            name: trip.name,
            destination: trip.destination ?? "",
            destinationSlug: trip.destination_slug,
            startDate: trip.start_date ?? "",
            endDate: trip.end_date ?? "",
          },
        },
        isSaving: false,
        deletingTripIds: new Set<number>(),
        currentUserId: "user-1",
        onEditStart: vi.fn(),
        onEditCancel: vi.fn(),
        onEditChange: vi.fn(),
        onEditSubmit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(markup).toContain('class="trip-row trip-row-editing"');
    expect(markup).toContain("/city-covers/toronto.webp");
    expect(markup).toContain('value="Toronto June"');
    expect(markup).toContain('class="trip-date-range-picker"');
    expect(markup).toContain("Jun 1 - 2, 2026");
    expect(markup).toContain('class="trip-edit-submit"');
    expect(markup).toContain('class="trip-edit-cancel"');
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

  it("renders the desktop shell as a fixed-height card with a static rail and a scrolling main pane", () => {
    const css = readFileSync(
      "src/styles/components/trips-dashboard-shell.css",
      "utf8",
    );
    const pageRule = cssRule(css, ".trips-page");
    const shellRule = cssRule(css, ".trips-dashboard-shell");
    const railRule = cssRule(css, ".trips-brand-rail");
    const mainPaneRule = cssRule(css, ".trips-main-pane");

    expect(pageRule).toContain("height: 100dvh;");
    expect(pageRule).toContain("overflow: hidden;");
    expect(shellRule).toContain("margin: 0 auto;");
    expect(shellRule).toContain("max-width: 1320px;");
    expect(shellRule).toContain("grid-template-rows: minmax(0, 1fr);");
    expect(shellRule).toContain("overflow: hidden;");
    expect(railRule).toContain("height: 100%;");
    expect(mainPaneRule).toContain("align-content: start;");
    expect(mainPaneRule).toContain("overflow-y: auto;");
    expect(mainPaneRule).toContain("min-height: 0;");
    // Mobile reverts to full-bleed native scroll.
    expect(css).toMatch(
      /@media \(max-width: 920px\)\s*{[\s\S]*\.trips-main-pane\s*{[^}]*overflow:\s*visible;/s,
    );
  });

  it("turns the mobile rail into an off-canvas drawer", () => {
    const css = readFileSync(
      "src/styles/components/trips-dashboard-shell.css",
      "utf8",
    );

    expect(cssRule(css, ".trips-mobile-topbar")).toContain("display: none;");
    expect(cssRule(css, ".trips-mobile-nav-backdrop")).toContain(
      "display: none;",
    );

    expect(css).toMatch(
      /@media \(max-width: 920px\)\s*{[\s\S]*\.trips-mobile-topbar\s*{[^}]*display:\s*flex;/s,
    );
    expect(css).toMatch(
      /@media \(max-width: 920px\)\s*{[\s\S]*\.trips-brand-rail\s*{[^}]*height:\s*100dvh;[^}]*max-height:\s*100dvh;[^}]*position:\s*fixed;[^}]*right:\s*0;[^}]*top:\s*0;[^}]*transform:\s*translateX\(100%\);[^}]*visibility:\s*hidden;[^}]*z-index:\s*25;/s,
    );
    expect(css).toMatch(
      /@media \(max-width: 920px\)\s*{[\s\S]*\.trips-brand-rail-open\s*{[^}]*transform:\s*translateX\(0\);[^}]*visibility:\s*visible;/s,
    );
  });

  it("keeps trip sections top-packed when the main pane has extra height", () => {
    const css = readFileSync(
      "src/styles/components/trips-dashboard.css",
      "utf8",
    );
    const rule = cssRule(css, ".trip-sections");

    expect(rule).toContain("align-content: start;");
  });

  it("lays out the upcoming and past card grids in responsive columns", () => {
    const css = readFileSync(
      "src/styles/components/trips-dashboard.css",
      "utf8",
    );

    expect(cssRule(css, ".trip-card-grid-upcoming")).toContain(
      "grid-template-columns: repeat(3, minmax(0, 1fr));",
    );
    expect(cssRule(css, ".trip-card-grid-past")).toContain(
      "grid-template-columns: repeat(4, minmax(0, 1fr));",
    );
    expect(css).toMatch(
      /@media \(max-width: 920px\)\s*{[\s\S]*\.trip-card-grid-upcoming\s*{[^}]*grid-template-columns:\s*1fr;/s,
    );
  });

});

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
