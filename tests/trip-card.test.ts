import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TripCard } from "@/components/TripCard";
import type { TripSummary } from "@/lib/types";
import { buildTripSummary } from "./helpers/fixtures";

function renderCard(props: Partial<Parameters<typeof TripCard>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(TripCard, {
      trip: buildTripSummary(),
      variant: "upcoming",
      canEdit: true,
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      ...props,
    }),
  );
}

describe("TripCard", () => {
  it("renders an upcoming cover card with metadata and titled icon actions", () => {
    const markup = renderCard();

    expect(markup).toContain('class="trip-card trip-card-upcoming"');
    expect(markup).toContain("/city-covers/toronto.webp");
    expect(markup).toContain("Toronto June");
    expect(markup).toContain('class="trip-card-destination"');
    expect(markup).toContain("Toronto");
    expect(markup).toContain("Jun 1 - 2, 2026");
    expect(markup).toContain('title="Edit trip Toronto June"');
    expect(markup).toContain('aria-label="Edit trip Toronto June"');
    expect(markup).toContain('title="Delete trip Toronto June"');
    expect(markup).toContain('aria-label="Delete trip Toronto June"');
  });

  it("shows a countdown chip for a future-dated upcoming trip", () => {
    const markup = renderCard({
      trip: buildTripSummary({
        start_date: "2099-01-01",
        end_date: "2099-01-05",
      }),
    });

    expect(markup).toContain('class="trip-badge trip-badge-accent trip-card-countdown"');
    expect(markup).toMatch(/D-\d+/);
  });

  it("does not show a countdown chip on past trips", () => {
    const markup = renderCard({ variant: "past" });

    expect(markup).toContain('class="trip-card trip-card-past"');
    expect(markup).not.toContain("trip-card-countdown");
    expect(markup).not.toContain("trip-card-add-dates");
  });

  it("uses the destination slug instead of inferring covers from destination text", () => {
    expect(
      renderCard({
        trip: buildTripSummary({
          destination: "Custom Toronto label",
          destination_slug: "toronto",
        }),
      }),
    ).toContain("/city-covers/toronto.webp");

    expect(
      renderCard({
        trip: buildTripSummary({
          destination: "Toronto",
          destination_slug: null,
        }),
      }),
    ).toContain("/sign-in-bg.jpg");
  });

  it("disables the delete button and shows the delete spinner while deleting", () => {
    const markup = renderCard({ isDeleting: true });

    expect(markup).toContain('aria-label="Deleting trip Toronto June"');
    expect(markup).toContain('title="Deleting trip Toronto June"');
    expect(markup).toContain("disabled");
    expect(markup).toContain("delete-loading-spinner");
  });

  it("reserves the destination row for trips without a destination", () => {
    const markup = renderCard({
      trip: {
        ...buildTripSummary(),
        destination: null,
      } as unknown as TripSummary,
    });

    expect(markup).toContain('class="trip-card-destination"');
    expect(markup).toContain("Destination needed");
  });

  it("offers to add dates for an undated upcoming trip the viewer owns", () => {
    const markup = renderCard({
      trip: buildTripSummary({ start_date: null, end_date: null }),
    });

    expect(markup).toContain("No dates yet");
    expect(markup).toContain('class="trip-card-add-dates"');
    expect(markup).toContain("+ Add dates");
  });

  it("hides owner-only controls when the viewer cannot edit", () => {
    const markup = renderCard({
      trip: buildTripSummary({ role: "viewer", start_date: null, end_date: null }),
      canEdit: false,
    });

    expect(markup).not.toContain("trip-card-actions");
    expect(markup).not.toContain("trip-card-add-dates");
    expect(markup).not.toContain("Edit trip Toronto June");
  });
});
