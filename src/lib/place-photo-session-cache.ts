// One preview photo is ~50-150KB as a data URL, so a small LRU keeps repeated
// picks free without letting a long session accumulate megabytes of images.
const PLACE_PHOTO_CACHE_MAX_ENTRIES = 20;

export type PlacePhotoSessionCache<T> = {
  getOrFetch: (key: string, fetcher: () => Promise<T>) => Promise<T>;
};

/**
 * In-memory promise cache keyed by Google place id. Concurrent and repeated
 * requests for the same place share one fetch (and thus one billed Place Photo
 * call) for the lifetime of the page; a rejected fetch is evicted so a
 * transient error stays retryable.
 */
export function createPlacePhotoSessionCache<T>(
  maxEntries: number = PLACE_PHOTO_CACHE_MAX_ENTRIES,
): PlacePhotoSessionCache<T> {
  const entries = new Map<string, Promise<T>>();

  return {
    getOrFetch(key: string, fetcher: () => Promise<T>): Promise<T> {
      const cached = entries.get(key);
      if (cached) {
        // Refresh recency: Map iteration order doubles as the LRU order.
        entries.delete(key);
        entries.set(key, cached);
        return cached;
      }

      const promise = fetcher();
      entries.set(key, promise);
      promise.catch(() => {
        if (entries.get(key) === promise) {
          entries.delete(key);
        }
      });

      while (entries.size > maxEntries) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey === undefined) break;
        entries.delete(oldestKey);
      }

      return promise;
    },
  };
}
