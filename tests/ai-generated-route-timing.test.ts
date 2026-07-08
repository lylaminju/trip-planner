import { describe, expect, it } from "vitest";

import {
  buildGeneratedRoutePairs,
  visitTimeAfterRouteDuration,
  type GeneratedVisitContext,
} from "@/server/ai-generated-route-timing";

describe("AI generated route timing", () => {
  it("builds route pairs grouped by first-seen date and ordered within each day", () => {
    const visits: GeneratedVisitContext[] = [
      visit({ itemId: 4, date: "2026-05-28", startTime: "10:00", order: 4 }),
      visit({ itemId: 2, date: "2026-05-27", startTime: "11:00", order: 2 }),
      visit({ itemId: 1, date: "2026-05-27", startTime: "09:00", order: 1 }),
      visit({ itemId: 3, date: "2026-05-27", startTime: "11:00", order: 3 }),
      visit({ itemId: 5, date: "2026-05-28", startTime: "11:00", order: 5 }),
    ];

    expect(buildGeneratedRoutePairs(visits)).toEqual([
      {
        from: visits[0],
        to: visits[4],
        isFirstOfDay: true,
      },
      {
        from: visits[2],
        to: visits[1],
        isFirstOfDay: true,
      },
      {
        from: visits[1],
        to: visits[3],
        isFirstOfDay: false,
      },
    ]);
  });

  it("moves a first attraction after the rounded route arrival time", () => {
    expect(visitTimeAfterRouteDuration("09:00", "09:20", 35 * 60)).toBe(
      "09:40",
    );
  });

  it("keeps or normalizes the planned time when route timing does not push it later", () => {
    expect(visitTimeAfterRouteDuration("09:00", "09:20", 5 * 60)).toBe(
      "09:20",
    );
    expect(visitTimeAfterRouteDuration("09:00", "09:23", -1)).toBe("09:30");
  });
});

function visit(
  overrides: Partial<GeneratedVisitContext> = {},
): GeneratedVisitContext {
  return {
    itemId: 1,
    date: "2026-05-27",
    startTime: "09:00",
    location: { latitude: 40.7, longitude: -73.9 },
    order: 1,
    ...overrides,
  };
}
