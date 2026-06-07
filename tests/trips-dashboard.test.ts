import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { TripsDashboard } from "@/components/TripsDashboard";

describe("TripsDashboard", () => {
  it("renders a log-out button in the dashboard header", () => {
    const markup = renderToStaticMarkup(createElement(TripsDashboard));

    expect(markup).toContain('class="trips-header-actions"');
    expect(markup).toContain("Log out");
  });
});
