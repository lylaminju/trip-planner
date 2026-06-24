import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DatePlacePicker } from "@/components/planner-panel/DatePlacePicker";
import { buildPlace } from "./helpers/fixtures";

describe("DatePlacePicker", () => {
  it("offers new place creation before the existing place list", () => {
    const markup = renderToStaticMarkup(
      createElement(DatePlacePicker, {
        date: "2026-06-01",
        places: [buildPlace({ name: "Existing cafe" })],
        style: {},
        onClose: vi.fn(),
        onCreatePlace: vi.fn(),
        onSelect: vi.fn(),
      }),
    );

    expect(markup).toContain("New place");
    expect(markup.indexOf("New place")).toBeLessThan(
      markup.indexOf("Existing cafe"),
    );
  });
});
