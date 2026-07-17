import { afterEach, describe, expect, it, vi } from "vitest";

import { createTrip, loadTrips } from "@/lib/trips-api";

describe("trips api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads trip arrays from JSON responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ trips: [] }),
    );

    await expect(loadTrips()).resolves.toEqual([]);
  });

  it("normalizes empty failed load responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    await expect(loadTrips()).rejects.toThrow("Failed to load trips.");
  });

  it("normalizes empty failed save responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    await expect(
      createTrip({
        name: "Toronto",
        destination: "Toronto",
        destination_slug: "toronto",
        destination_latitude: null,
        destination_longitude: null,
        start_date: null,
        end_date: null,
      }),
    ).rejects.toThrow("Failed to save trip.");
  });
});
