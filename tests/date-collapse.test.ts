import { describe, expect, it } from "vitest";

import {
  expandOrCollapseAllDates,
  toggleCollapsedDate,
} from "@/lib/date-collapse";

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

describe("expandOrCollapseAllDates", () => {
  const dayDates = ["2026-06-01", "2026-06-02", "2026-06-03"];

  it("collapses all days when none are collapsed", () => {
    const next = expandOrCollapseAllDates(new Set(), dayDates);

    expect(next).toEqual(new Set(dayDates));
  });

  it("collapses the remaining days when some are already collapsed", () => {
    const next = expandOrCollapseAllDates(
      new Set(["2026-06-01"]),
      dayDates,
    );

    expect(next).toEqual(new Set(dayDates));
  });

  it("expands all days when every day is already collapsed", () => {
    const next = expandOrCollapseAllDates(new Set(dayDates), dayDates);

    expect(next).toEqual(new Set());
  });

  it("always returns a new set and leaves the current set unchanged", () => {
    const current = new Set(["2026-06-01"]);
    const next = expandOrCollapseAllDates(current, dayDates);

    expect(next).not.toBe(current);
    expect(next).toEqual(new Set(dayDates));
    expect(current).toEqual(new Set(["2026-06-01"]));
  });

  it("collapses nothing when there are no day dates", () => {
    expect(expandOrCollapseAllDates(new Set(), [])).toEqual(new Set());
  });
});
