import { describe, expect, it } from "vitest";

import { toggleSelectedId } from "@/lib/selection";

describe("toggleSelectedId", () => {
  it("selects an inactive id", () => {
    expect(toggleSelectedId(null, 12)).toBe(12);
    expect(toggleSelectedId(3, 12)).toBe(12);
  });

  it("clears the active id when clicked again", () => {
    expect(toggleSelectedId(12, 12)).toBeNull();
  });
});
