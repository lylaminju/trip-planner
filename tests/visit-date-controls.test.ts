import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AddEditPlaceModal } from "@/components/AddEditPlaceModal";
import { EditItineraryItemModal } from "@/components/EditItineraryItemModal";
import type { VisitDateOption } from "@/lib/types";
import { buildItineraryItem, buildPlace } from "./helpers/fixtures";

const visitDateOptions: VisitDateOption[] = [
  { value: "2026-06-01", label: "Day 1 · Jun 1, 2026" },
  { value: "2026-06-02", label: "Day 2 · Jun 2, 2026" },
];

function renderAddModal(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(AddEditPlaceModal, {
      tripId: 1,
      place: null,
      savedPlaces: [],
      hasCuratedCandidates: false,
      visitDateOptions,
      onCancel: vi.fn(),
      onResolveUrl: vi.fn(),
      onSave: vi.fn(),
      ...overrides,
    }),
  );
}

describe("add / edit place modal", () => {
  it("opens the add flow on the search step", () => {
    const markup = renderAddModal();

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain("Search Google Maps");
    // Scheduling (day tiles / date select) only appears after a place is chosen.
    expect(markup).not.toContain("Which day?");
    expect(markup).not.toContain('name="visit_date"');
    expect(markup).not.toContain('type="date"');
  });

  it("shows the resolved place details when editing", () => {
    const markup = renderToStaticMarkup(
      createElement(AddEditPlaceModal, {
        tripId: 1,
        place: buildPlace({ name: "Existing stop" }),
        savedPlaces: [],
        hasCuratedCandidates: false,
        visitDateOptions,
        onCancel: vi.fn(),
        onResolveUrl: vi.fn(),
        onSave: vi.fn(),
      }),
    );

    expect(markup).toContain("Existing stop");
    expect(markup).toContain("Google Maps link");
    expect(markup).toContain("Found on Google Maps");
    expect(markup).toContain("Save");
    // Editing skips the paste step.
    expect(markup).not.toContain("Continue");
  });

  it("drops an out-of-range visit date instead of preserving it", () => {
    const markup = renderToStaticMarkup(
      createElement(EditItineraryItemModal, {
        item: buildItineraryItem({
          visit_date: "2026-06-05",
          place: buildPlace({ name: "Late stop" }),
        }),
        visitDateOptions,
        onCancel: vi.fn(),
        onSave: vi.fn(),
      }),
    );

    expect(markup).not.toContain("Current date");
    expect(markup).not.toContain('value="2026-06-05"');
    expect(markup).not.toContain('type="date" name="visit_date"');
  });
});
