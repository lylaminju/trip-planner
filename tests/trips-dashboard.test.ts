import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { TripSection, TripsDashboard } from "@/components/TripsDashboard";

describe("TripsDashboard", () => {
  it("renders a log-out button in the dashboard header", () => {
    const markup = renderToStaticMarkup(createElement(TripsDashboard));

    expect(markup).toContain('class="trips-header-actions"');
    expect(markup).toContain("Log out");
  });

  it("renders empty trip sections as bucket-sized placeholders", () => {
    const markup = renderToStaticMarkup(
      createElement(TripSection, {
        title: "Upcoming Trips",
        trips: [],
        editing: null,
        isSaving: false,
        deletingTripIds: new Set<number>(),
        timeZoneOptions: [],
        onEditStart: vi.fn(),
        onEditCancel: vi.fn(),
        onEditChange: vi.fn(),
        onEditSubmit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(markup).toContain('class="trip-empty-bucket"');
    expect(markup).toContain('aria-label="No trips in this section."');
    expect(markup).toContain('viewBox="0 0 64 64"');
    expect(markup).not.toContain(
      '<p class="trip-empty-text">No trips in this section.</p>',
    );
  });
});
