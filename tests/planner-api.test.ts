import { afterEach, describe, expect, it, vi } from "vitest";

import { loadAiPlanningSetup } from "@/lib/planner-api";

describe("planner api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads AI planning setup from the trip scoped endpoint", async () => {
    const setup = {
      trip: {
        id: 1,
        created_by: "user-1",
        name: "New York City",
        destination: "New York City",
        destination_slug: "new-york-city",
        start_date: "2026-05-27",
        end_date: "2026-05-29",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      isSupportedDestination: true,
      candidates: [],
      lodging: null,
      preferences: null,
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(setup));

    await expect(loadAiPlanningSetup(1)).resolves.toEqual(setup);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trips/1/ai-planning/setup",
    );
  });

  it("normalizes failed AI setup responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    await expect(loadAiPlanningSetup(1)).rejects.toThrow(
      "Failed to load AI planning setup.",
    );
  });
});
