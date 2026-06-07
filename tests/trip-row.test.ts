import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TripRow } from "@/components/TripRow";
import type { TripSummary } from "@/lib/types";

describe("TripRow", () => {
  it("keeps timezone beside the date range and uses titled icon actions", () => {
    const markup = renderToStaticMarkup(
      createElement(TripRow, {
        trip: tripSummary(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(markup).toContain(
      "2026-06-01 to 2026-06-02 (America/Toronto)",
    );
    expect(markup).toContain('title="Edit trip Toronto June"');
    expect(markup).toContain('aria-label="Edit trip Toronto June"');
    expect(markup).toContain('title="Delete trip Toronto June"');
    expect(markup).toContain('aria-label="Delete trip Toronto June"');
    expect(markup).toContain("<svg");
    expect(markup).not.toContain(">Edit<");
    expect(markup).not.toContain(">Delete<");
  });

  it("disables the delete button and shows the delete spinner while deleting", () => {
    const markup = renderToStaticMarkup(
      createElement(TripRow, {
        trip: tripSummary(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        isDeleting: true,
      }),
    );

    expect(markup).toContain('aria-label="Deleting trip Toronto June"');
    expect(markup).toContain('title="Deleting trip Toronto June"');
    expect(markup).toContain("disabled");
    expect(markup).toContain("delete-loading-spinner");
    expect(markup).not.toContain("M4 7h16");
  });
});

function tripSummary(): TripSummary {
  return {
    id: 12,
    created_by: "user-1",
    name: "Toronto June",
    start_date: "2026-06-01",
    end_date: "2026-06-02",
    timezone: "America/Toronto",
    role: "owner",
    created_at: "2026-05-20 00:00:00",
    updated_at: "2026-05-20 00:00:00",
  };
}
