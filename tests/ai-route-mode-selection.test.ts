import { describe, expect, it, vi } from "vitest";

import { chooseAiRouteMode } from "@/server/ai-route-mode-selection";

describe("chooseAiRouteMode", () => {
  it("uses a non-walking mode for clearly long walking-and-transit segments without probing", async () => {
    const getWalkingDurationSeconds = vi.fn();

    await expect(
      chooseAiRouteMode({
        preferredModes: ["walking", "transit"],
        from: { latitude: 34.102, longitude: -118.3409 },
        to: { latitude: 34.134115, longitude: -118.321548 },
        getWalkingDurationSeconds,
      }),
    ).resolves.toBe("transit");

    expect(getWalkingDurationSeconds).not.toHaveBeenCalled();
  });

  it("keeps short segments as walking when the walking probe is reasonable", async () => {
    const getWalkingDurationSeconds = vi.fn().mockResolvedValue(18 * 60);

    await expect(
      chooseAiRouteMode({
        preferredModes: ["walking", "transit"],
        from: { latitude: 34.1016, longitude: -118.3269 },
        to: { latitude: 34.102, longitude: -118.3409 },
        getWalkingDurationSeconds,
      }),
    ).resolves.toBe("walking");

    expect(getWalkingDurationSeconds).toHaveBeenCalledTimes(1);
  });

  it("uses a non-walking mode when a short segment probes as a long walk", async () => {
    await expect(
      chooseAiRouteMode({
        preferredModes: ["walking", "transit"],
        from: { latitude: 34.1016, longitude: -118.3269 },
        to: { latitude: 34.102, longitude: -118.3409 },
        getWalkingDurationSeconds: vi.fn().mockResolvedValue(35 * 60),
      }),
    ).resolves.toBe("transit");
  });

  it("uses a non-walking mode when a short segment cannot be probed", async () => {
    await expect(
      chooseAiRouteMode({
        preferredModes: ["walking", "transit"],
        from: { latitude: 34.1016, longitude: -118.3269 },
        to: { latitude: 34.102, longitude: -118.3409 },
        getWalkingDurationSeconds: vi.fn().mockRejectedValue(new Error("boom")),
      }),
    ).resolves.toBe("transit");
  });

  it("returns the first preferred mode when walking is not selected", async () => {
    await expect(
      chooseAiRouteMode({
        preferredModes: ["driving", "transit"],
        from: { latitude: 34.1016, longitude: -118.3269 },
        to: { latitude: 34.102, longitude: -118.3409 },
        getWalkingDurationSeconds: vi.fn(),
      }),
    ).resolves.toBe("driving");
  });
});
