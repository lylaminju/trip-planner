import { describe, expect, it } from "vitest";

import { resolveMobileSheetReleaseState } from "@/lib/mobile-sheet";

describe("mobile sheet drag release", () => {
  it("expands from collapsed on pointerup when the handle was tapped", () => {
    expect(
      resolveMobileSheetReleaseState({
        deltaY: 0,
        dragMoved: false,
        state: "collapsed",
      }),
    ).toBe("half");
  });

  it("treats sub-threshold pointer movement as a tap instead of waiting for click", () => {
    expect(
      resolveMobileSheetReleaseState({
        deltaY: -12,
        dragMoved: true,
        state: "collapsed",
      }),
    ).toBe("half");
  });

  it("keeps directional drag releases for larger movements", () => {
    expect(
      resolveMobileSheetReleaseState({
        deltaY: -32,
        dragMoved: true,
        state: "half",
      }),
    ).toBe("full");
    expect(
      resolveMobileSheetReleaseState({
        deltaY: 32,
        dragMoved: true,
        state: "half",
      }),
    ).toBe("collapsed");
  });
});
