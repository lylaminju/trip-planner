import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TripRow } from "@/components/TripRow";
import type { TripSummary } from "@/lib/types";
import { buildTripSummary } from "./helpers/fixtures";

describe("TripRow", () => {
  it("renders a cover card with trip metadata and titled icon actions", () => {
    const markup = renderToStaticMarkup(
      createElement(TripRow, {
        trip: buildTripSummary(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(markup).toContain("/city-covers/toronto.webp");
    expect(markup).toContain("Jun 1 - 2, 2026");
    expect(markup).toContain("2 days");
    expect(markup).toContain("Toronto");
    expect(markup).toContain('class="trip-destination-icon"');
    expect(markup).toContain('title="Edit trip Toronto June"');
    expect(markup).toContain('aria-label="Edit trip Toronto June"');
    expect(markup).toContain('title="Delete trip Toronto June"');
    expect(markup).toContain('aria-label="Delete trip Toronto June"');
    expect(markup).toContain("<svg");
  });

  it("uses the destination slug instead of inferring covers from destination text", () => {
    const curatedMarkup = renderToStaticMarkup(
      createElement(TripRow, {
        trip: buildTripSummary({
          destination: "Custom Toronto label",
          destination_slug: "toronto",
        }),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );
    expect(curatedMarkup).toContain("/city-covers/toronto.webp");

    const customMarkup = renderToStaticMarkup(
      createElement(TripRow, {
        trip: buildTripSummary({
          destination: "Toronto",
          destination_slug: null,
        }),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );
    expect(customMarkup).toContain("/sign-in-bg.jpg");
  });

  it("disables the delete button and shows the delete spinner while deleting", () => {
    const markup = renderToStaticMarkup(
      createElement(TripRow, {
        trip: buildTripSummary(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        isDeleting: true,
      }),
    );

    expect(markup).toContain('aria-label="Deleting trip Toronto June"');
    expect(markup).toContain('title="Deleting trip Toronto June"');
    expect(markup).toContain("disabled");
    expect(markup).toContain("delete-loading-spinner");
  });

  it("reserves the destination row for legacy trips without a destination", () => {
    const markup = renderToStaticMarkup(
      createElement(TripRow, {
        trip: { ...buildTripSummary(), destination: null } as unknown as TripSummary,
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(markup).toContain('class="trip-destination"');
    expect(markup).toContain("Destination needed");
  });

  it("keeps missing trip dates visually compact", () => {
    const markup = renderToStaticMarkup(
      createElement(TripRow, {
        trip: { ...buildTripSummary(), start_date: null, end_date: null },
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(markup).toContain('aria-label="Dates not set"');
    expect(markup).toContain(">-<");
    expect(markup).not.toContain("Add dates to sort this trip");
  });
});
