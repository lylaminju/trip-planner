import { describe, expect, it } from "vitest";

import {
  DEFAULT_QUICK_VISIT_TIME,
  normalizeQuickVisitTime,
} from "@/lib/quick-visit-time";

describe("quick visit time helpers", () => {
  it("normalizes valid time text into padded HH:MM", () => {
    expect(normalizeQuickVisitTime("9:05")).toBe("09:05");
    expect(normalizeQuickVisitTime("23:59")).toBe("23:59");
  });

  it("rejects blank and malformed time text", () => {
    expect(normalizeQuickVisitTime("")).toBeNull();
    expect(normalizeQuickVisitTime("29:61")).toBeNull();
    expect(normalizeQuickVisitTime("morning")).toBeNull();
  });

  it("uses a practical default when adding a missing time", () => {
    expect(DEFAULT_QUICK_VISIT_TIME).toBe("09:00");
  });
});
