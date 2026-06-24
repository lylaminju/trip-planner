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

describe("visit date controls", () => {
  it("allows add-place submission without a typed name for URL auto-fill", () => {
    const addMarkup = renderToStaticMarkup(
      createElement(AddEditPlaceModal, {
        place: null,
        visitDateOptions,
        onCancel: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    const editMarkup = renderToStaticMarkup(
      createElement(AddEditPlaceModal, {
        place: buildPlace({ name: "Existing stop" }),
        visitDateOptions,
        onCancel: vi.fn(),
        onSave: vi.fn(),
      }),
    );

    const addNameInput = addMarkup.match(/<input[^>]*name="name"[^>]*>/)?.[0];
    const editNameInput = editMarkup.match(/<input[^>]*name="name"[^>]*>/)?.[0];

    expect(addNameInput).toContain('placeholder="Auto-filled when possible"');
    expect(addNameInput).not.toContain('required=""');
    expect(editNameInput).toContain('required=""');
  });

  it("uses a valid trip-day select when adding an initial visit", () => {
    const markup = renderToStaticMarkup(
      createElement(AddEditPlaceModal, {
        place: null,
        visitDateOptions,
        onCancel: vi.fn(),
        onSave: vi.fn(),
      }),
    );

    expect(markup).toContain('<select name="visit_date"');
    expect(markup).toContain("Day 1 · Jun 1, 2026");
    expect(markup).not.toContain('type="date" name="visit_date"');
  });

  it("preselects a target visit date when creating from a day picker", () => {
    const markup = renderToStaticMarkup(
      createElement(AddEditPlaceModal, {
        place: null,
        visitDateOptions,
        defaultVisitDate: "2026-06-02",
        onCancel: vi.fn(),
        onSave: vi.fn(),
      }),
    );

    expect(markup).toContain('<option value="2026-06-02" selected="">');
  });

  it("keeps an existing out-of-range visit date without offering free date entry", () => {
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

    expect(markup).toContain("Current date: Jun 5, 2026");
    expect(markup).not.toContain('type="date" name="visit_date"');
  });

  it("does not offer free date entry when trip dates are not confirmed", () => {
    const markup = renderToStaticMarkup(
      createElement(AddEditPlaceModal, {
        place: null,
        visitDateOptions: [],
        onCancel: vi.fn(),
        onSave: vi.fn(),
      }),
    );

    expect(markup).toContain("Set trip dates first");
    expect(markup).toContain("disabled");
    expect(markup).not.toContain('type="date" name="visit_date"');
  });
});
