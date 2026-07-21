import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EditItineraryItemModal } from "@/components/EditItineraryItemModal";
import type { VisitDateOption } from "@/lib/types";

import { buildItineraryItem, buildPlace } from "./helpers/fixtures";

const visitDateOptions: VisitDateOption[] = [
  { value: "2026-06-01", label: "Sun, Jun 1" },
];

describe("EditItineraryItemModal", () => {
  it("renders a duplicate-mode dialog prefilled from the source visit", () => {
    const item = buildItineraryItem({
      notes: "Meet at the entrance",
      place: buildPlace({ id: 7, name: "Bryant Park" }),
    });

    const markup = renderToStaticMarkup(
      createElement(EditItineraryItemModal, {
        item,
        mode: "duplicate",
        visitDateOptions,
        onCancel: vi.fn(),
        onSave: vi.fn(),
      }),
    );

    expect(markup).toContain("Duplicate visit");
    expect(markup).toContain("Bryant Park");
    expect(markup).toContain("Meet at the entrance");
  });

  it("titles the dialog by mode: add for a place, edit for an item", () => {
    const place = buildPlace({ id: 7, name: "Bryant Park" });

    const addMarkup = renderToStaticMarkup(
      createElement(EditItineraryItemModal, {
        place,
        visitDateOptions,
        onCancel: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    const editMarkup = renderToStaticMarkup(
      createElement(EditItineraryItemModal, {
        item: buildItineraryItem({ place }),
        visitDateOptions,
        onCancel: vi.fn(),
        onSave: vi.fn(),
      }),
    );

    expect(addMarkup).toContain("Add visit");
    expect(editMarkup).toContain("Edit visit");
  });
});
