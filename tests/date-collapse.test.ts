import { describe, expect, it } from "vitest";

import { toggleCollapsedDate } from "@/lib/date-collapse";

describe("toggleCollapsedDate", () => {
  it("adds a date to an empty collapsed set", () => {
    const current = new Set<string>();
    const next = toggleCollapsedDate(current, "2026-06-01");

    expect(next).toEqual(new Set(["2026-06-01"]));
    expect(next).not.toBe(current);
    expect(current).toEqual(new Set());
  });

  it("removes an already collapsed date", () => {
    expect(toggleCollapsedDate(new Set(["2026-06-01"]), "2026-06-01")).toEqual(
      new Set(),
    );
  });

  it("preserves other collapsed dates", () => {
    const current = new Set(["2026-06-01", "2026-06-02"]);
    const next = toggleCollapsedDate(current, "2026-06-02");

    expect(next).toEqual(new Set(["2026-06-01"]));
    expect(next).not.toBe(current);
    expect(current).toEqual(new Set(["2026-06-01", "2026-06-02"]));
  });
});
