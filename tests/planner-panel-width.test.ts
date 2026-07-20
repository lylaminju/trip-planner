import { describe, expect, it } from "vitest";

import {
  clampPlannerPanelWidth,
  MAP_PANEL_RESERVED_WIDTH_PX,
  PLANNER_PANEL_MIN_WIDTH_PX,
  readStoredPlannerPanelWidth,
  writeStoredPlannerPanelWidth,
  type PlannerPanelWidthStorage,
} from "@/lib/planner-panel-width";

function fakeStorage(
  initial: Record<string, string> = {},
): PlannerPanelWidthStorage & { entries: Record<string, string> } {
  const entries = { ...initial };
  return {
    entries,
    getItem: (key) => (key in entries ? entries[key] : null),
    setItem: (key, value) => {
      entries[key] = value;
    },
  };
}

describe("clampPlannerPanelWidth", () => {
  const viewportWidth = 1440;
  const maxWidth = viewportWidth - MAP_PANEL_RESERVED_WIDTH_PX;

  it.each([
    ["below minimum", 100, PLANNER_PANEL_MIN_WIDTH_PX],
    ["at minimum", PLANNER_PANEL_MIN_WIDTH_PX, PLANNER_PANEL_MIN_WIDTH_PX],
    ["in range", 700, 700],
    ["above viewport-reserved maximum", 2000, maxWidth],
  ])("clamps width %s", (_label, width, expected) => {
    expect(clampPlannerPanelWidth(width, viewportWidth)).toBe(expected);
  });

  it("never returns below the minimum on tiny viewports", () => {
    expect(clampPlannerPanelWidth(500, 400)).toBe(PLANNER_PANEL_MIN_WIDTH_PX);
  });
});

describe("planner panel width storage", () => {
  it("round-trips a stored width", () => {
    const storage = fakeStorage();
    writeStoredPlannerPanelWidth(storage, 712);

    expect(readStoredPlannerPanelWidth(storage)).toBe(712);
  });

  it("returns null without storage or a stored value", () => {
    expect(readStoredPlannerPanelWidth(null)).toBeNull();
    expect(readStoredPlannerPanelWidth(fakeStorage())).toBeNull();
  });

  it.each([["abc"], [""], ["  "], ["NaN"], ["-50"], ["Infinity"], ["120"]])(
    "fails closed on malformed or out-of-range stored value %j",
    (raw) => {
      const storage = fakeStorage({
        "trip-planner:planner-panel-width:v1": raw,
      });

      expect(readStoredPlannerPanelWidth(storage)).toBeNull();
    },
  );

  it("fails closed when storage access throws", () => {
    const storage: PlannerPanelWidthStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };

    expect(readStoredPlannerPanelWidth(storage)).toBeNull();
    expect(() => writeStoredPlannerPanelWidth(storage, 700)).not.toThrow();
  });
});
