import { describe, expect, it, vi } from "vitest";

import { createPlacePhotoSessionCache } from "@/lib/place-photo-session-cache";

describe("createPlacePhotoSessionCache", () => {
  it("shares one fetch across repeated and concurrent requests for a key", async () => {
    const cache = createPlacePhotoSessionCache<string>();
    const fetcher = vi.fn().mockResolvedValue("photo-a");

    const [first, second] = await Promise.all([
      cache.getOrFetch("place-a", fetcher),
      cache.getOrFetch("place-a", fetcher),
    ]);
    const third = await cache.getOrFetch("place-a", fetcher);

    expect(first).toBe("photo-a");
    expect(second).toBe("photo-a");
    expect(third).toBe("photo-a");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("caches a resolved null so a photo-less place is not refetched", async () => {
    const cache = createPlacePhotoSessionCache<string | null>();
    const fetcher = vi.fn().mockResolvedValue(null);

    await cache.getOrFetch("place-a", fetcher);
    await cache.getOrFetch("place-a", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("evicts a rejected fetch so the next request retries", async () => {
    const cache = createPlacePhotoSessionCache<string>();
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue("photo-a");

    await expect(cache.getOrFetch("place-a", fetcher)).rejects.toThrow(
      "network",
    );
    await expect(cache.getOrFetch("place-a", fetcher)).resolves.toBe(
      "photo-a",
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("evicts the least recently used key beyond the entry cap", async () => {
    const cache = createPlacePhotoSessionCache<string>(2);
    const fetcher = vi.fn(async (value: string) => value);

    await cache.getOrFetch("a", () => fetcher("a"));
    await cache.getOrFetch("b", () => fetcher("b"));
    // Touch "a" so "b" becomes the least recently used entry.
    await cache.getOrFetch("a", () => fetcher("a-again"));
    await cache.getOrFetch("c", () => fetcher("c"));

    await cache.getOrFetch("a", () => fetcher("a-refetch"));
    await cache.getOrFetch("b", () => fetcher("b-refetch"));

    const calls = fetcher.mock.calls.map(([value]) => value);
    expect(calls).toEqual(["a", "b", "c", "b-refetch"]);
  });
});
