import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditTripModal } from "@/components/EditTripModal";
import { TripEditForm } from "@/components/TripEditForm";
import { formFromTrip } from "@/components/trip-planner-app-utils";
import * as validation from "@/hooks/useTripDateEditValidation";
import { buildTripSummary } from "./helpers/fixtures";

const trip = buildTripSummary({
  start_date: "2027-02-15",
  end_date: "2027-02-21",
});
const visits = [
  { id: 1, visit_date: "2027-02-15" },
  { id: 2, visit_date: "2027-02-21" },
];

function renderModal(
  overrides: Partial<ComponentProps<typeof EditTripModal>> = {},
) {
  return renderToStaticMarkup(
    createElement(EditTripModal, {
      form: formFromTrip(trip),
      tripDates: trip,
      scheduledVisits: visits,
      error: null,
      isSaving: false,
      onChange: vi.fn(),
      onCancel: vi.fn(),
      onSubmit: vi.fn(),
      ...overrides,
    }),
  );
}

function renderInline(startDate = trip.start_date!, endDate = trip.end_date!) {
  return renderToStaticMarkup(
    createElement(TripEditForm, {
      trip,
      form: { ...formFromTrip(trip), startDate, endDate },
      isSaving: false,
      onChange: vi.fn(),
      onSelectGoogle: vi.fn(),
      onCancel: vi.fn(),
      onSubmit: vi.fn(),
    }),
  );
}

function submitButton(markup: string) {
  const button = markup.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0];
  expect(button).toBeDefined();
  return button!;
}

afterEach(() => vi.restoreAllMocks());

describe("trip date edit forms", () => {
  it("allows an equal-length move and describes the itinerary movement", () => {
    const markup = renderModal({
      form: {
        ...formFromTrip(trip),
        startDate: "2027-02-08",
        endDate: "2027-02-14",
      },
    });

    // A valid move must remain submittable; the visible status explains its effect.
    expect(submitButton(markup)).not.toContain("disabled");
    expect(submitButton(markup)).toContain("aria-describedby=");
    expect(markup).toContain('role="status"');
    expect(markup).toContain("day numbers and visit times");
  });

  it("disables saving and announces the last planned day when shortening would lose visits", () => {
    const markup = renderModal({
      form: { ...formFromTrip(trip), endDate: "2027-02-19" },
    });

    expect(submitButton(markup)).toContain('disabled=""');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Day 7");
    expect(markup).toContain('aria-label="Trip dates"');
    expect(submitButton(markup)).toContain("aria-describedby=");
  });

  it("allows shortening empty trailing days without blocking the save", () => {
    const markup = renderModal({
      form: { ...formFromTrip(trip), endDate: "2027-02-19" },
      scheduledVisits: [visits[0]],
    });

    expect(submitButton(markup)).not.toContain("disabled");
  });

  it.each([
    ["incomplete", "2027-02-08", ""],
    ["cleared", "", ""],
  ])(
    "blocks %s dates while visits are scheduled",
    (_name, startDate, endDate) => {
      const markup = renderModal({
        form: { ...formFromTrip(trip), startDate, endDate },
      });

      expect(submitButton(markup)).toContain('disabled=""');
      expect(markup).toContain('role="alert"');
    },
  );

  it("allows a metadata edit without requiring legacy out-of-range visits to be repaired", () => {
    const markup = renderModal({
      scheduledVisits: [{ id: 1, visit_date: "2026-02-15" }],
    });

    expect(submitButton(markup)).not.toContain("disabled");
  });

  it("blocks changed dates until the dashboard has checked the itinerary", () => {
    const markup = renderInline("2027-02-08", "2027-02-14");

    expect(submitButton(markup)).toContain('disabled=""');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Checking your itinerary");
    // Validation must not trap users in the editor.
    expect(markup).toMatch(
      /<button[^>]*class="trip-edit-cancel">Cancel<\/button>/,
    );
  });

  it("allows unchanged-date dashboard edits while the itinerary loads", () => {
    expect(submitButton(renderInline())).not.toContain("disabled");
  });

  it("shows a retry action and keeps save blocked after the itinerary check fails", () => {
    vi.spyOn(validation, "useTripDateEditValidation").mockReturnValue({
      error: "Couldn't check your itinerary. Retry before changing the dates.",
      isChecking: false,
      willShift: false,
      retry: vi.fn(),
    });
    const markup = renderInline("2027-02-08", "2027-02-14");

    expect(submitButton(markup)).toContain('disabled=""');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('<button type="button">Retry</button>');
  });
});
