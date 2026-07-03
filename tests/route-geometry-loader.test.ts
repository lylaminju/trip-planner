import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchRouteGeometry } from "@/lib/planner-api";
import { loadRouteGeometries } from "@/lib/route-geometry-loader";
import type { RouteGeometry } from "@/lib/types";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

describe("route geometry loading", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("limits active geometry fetches and publishes each route as it resolves", async () => {
    const deferreds = new Map<number, Deferred<RouteGeometryResult>>();
    const started: number[] = [];
    const published: number[] = [];
    let active = 0;
    let maxActive = 0;

    const load = loadRouteGeometries({
      segmentIds: [1, 2, 3, 4],
      concurrency: 2,
      signal: new AbortController().signal,
      fetchGeometry: (segmentId) => {
        started.push(segmentId);
        active += 1;
        maxActive = Math.max(maxActive, active);

        const deferred = createDeferred<RouteGeometryResult>();
        deferreds.set(segmentId, deferred);
        return deferred.promise.finally(() => {
          active -= 1;
        });
      },
      onResult: (result) => {
        if (result.geometry) published.push(result.geometry.segment_id);
      },
    });

    await flushPromises();
    expect(started).toEqual([1, 2]);
    expect(maxActive).toBe(2);

    deferreds.get(2)?.resolve(geometryResult(2));
    await flushPromises();
    expect(published).toEqual([2]);
    expect(started).toEqual([1, 2, 3]);

    deferreds.get(1)?.resolve(geometryResult(1));
    deferreds.get(3)?.resolve(geometryResult(3));
    await flushPromises();
    expect(published).toEqual([2, 1, 3]);
    expect(started).toEqual([1, 2, 3, 4]);

    deferreds.get(4)?.resolve(geometryResult(4));
    await load;

    expect(published).toEqual([2, 1, 3, 4]);
    expect(maxActive).toBe(2);
  });

  it("stops publishing and scheduling geometry work after abort", async () => {
    const controller = new AbortController();
    const deferreds = new Map<number, Deferred<RouteGeometryResult>>();
    const started: number[] = [];
    const signals: AbortSignal[] = [];
    const published: number[] = [];

    const load = loadRouteGeometries({
      segmentIds: [1, 2, 3],
      concurrency: 2,
      signal: controller.signal,
      fetchGeometry: (segmentId, signal) => {
        started.push(segmentId);
        signals.push(signal);

        const deferred = createDeferred<RouteGeometryResult>();
        deferreds.set(segmentId, deferred);
        return deferred.promise;
      },
      onResult: (result) => {
        if (result.geometry) published.push(result.geometry.segment_id);
      },
    });

    await flushPromises();
    controller.abort();
    deferreds.get(1)?.resolve(geometryResult(1));
    deferreds.get(2)?.resolve(geometryResult(2));
    await load;

    expect(started).toEqual([1, 2]);
    expect(signals).toEqual([controller.signal, controller.signal]);
    expect(published).toEqual([]);
  });

  it("passes abort signals to route geometry fetches without surfacing aborts as warnings", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_path: string, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      controller.abort();
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRouteGeometry(1, 12, controller.signal)).resolves.toEqual(
      {
        geometry: null,
        error: null,
      },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trips/1/route-segments/12/geometry",
      { signal: controller.signal },
    );
  });
});

type RouteGeometryResult = {
  geometry: RouteGeometry | null;
  error: string | null;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

function geometryResult(segmentId: number): RouteGeometryResult {
  return {
    geometry: {
      segment_id: segmentId,
      status: "ok",
      encoded_polyline: `encoded-${segmentId}`,
    },
    error: null,
  };
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
