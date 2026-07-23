import { describe, expect, it } from "vitest";

import {
  GENERATION_PROGRESS_CEILING,
  trickleProgress,
} from "@/components/ai-planning-wizard/generation-progress";

describe("trickleProgress", () => {
  it("starts at zero", () => {
    expect(trickleProgress(0)).toBe(0);
  });

  it("clamps negative elapsed time to zero", () => {
    expect(trickleProgress(-5000)).toBe(0);
  });

  it("increases monotonically over time", () => {
    let previous = -1;
    for (let elapsed = 0; elapsed <= 120000; elapsed += 5000) {
      const current = trickleProgress(elapsed);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });

  it("never reaches the ceiling, so the bar cannot imply completion", () => {
    // Even at an implausibly long wait the fill stays below the cap.
    expect(trickleProgress(600000)).toBeLessThan(GENERATION_PROGRESS_CEILING);
  });

  it("approaches the ceiling on long runs", () => {
    expect(trickleProgress(120000)).toBeGreaterThan(
      GENERATION_PROGRESS_CEILING * 0.99,
    );
  });
});
