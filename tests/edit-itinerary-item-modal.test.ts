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

  // An itinerary item exists only while it has a visit date, so add and
  // duplicate must not offer "keep it unscheduled": saving that used to return
  // a successful snapshot without creating anything.
  it("offers the unscheduled option only when editing an existing visit", () => {
    const place = buildPlace({ id: 7, name: "Bryant Park" });
    const item = buildItineraryItem({ place });

    const renderMode = (props: Record<string, unknown>) =>
      renderToStaticMarkup(
        createElement(EditItineraryItemModal, {
          visitDateOptions,
          onCancel: vi.fn(),
          onSave: vi.fn(),
          ...props,
        }),
      );

    expect(renderMode({ item })).toContain("place-later-button");
    expect(renderMode({ place })).not.toContain("place-later-button");
    expect(renderMode({ item, mode: "duplicate" })).not.toContain(
      "place-later-button",
    );
  });

  it("blocks saving an add-visit dialog until a day is picked", () => {
    const markup = renderToStaticMarkup(
      createElement(EditItineraryItemModal, {
        place: buildPlace({ id: 7, name: "Bryant Park" }),
        visitDateOptions,
        onCancel: vi.fn(),
        onSave: vi.fn(),
      }),
    );

    expect(markup).toMatch(/place-primary-button"[^>]*disabled/);
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
