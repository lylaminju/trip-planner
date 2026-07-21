import { useEffect, useMemo, useRef, useState } from "react";

import { fetchRouteGeometry } from "@/lib/planner-api";
import {
  getRouteGeometryBrowserCacheStorage,
  pruneRouteGeometryBrowserCache,
  readRouteGeometryBrowserCache,
  routeGeometryBrowserCacheSignature,
  writeRouteGeometryBrowserCache,
} from "@/lib/route-geometry-browser-cache";
import { loadRouteGeometries } from "@/lib/route-geometry-loader";
import { isOptimisticSegmentId } from "@/lib/route-reconciliation";
import type { PlannerSnapshot, RouteGeometry } from "@/lib/types";

export function useRouteGeometries(
  tripId: number,
  snapshot: PlannerSnapshot,
): {
  routeGeometries: Map<number, RouteGeometry>;
  routeGeometryError: string | null;
} {
  const [routeGeometries, setRouteGeometries] = useState<
    Map<number, RouteGeometry>
  >(new Map());
  const [routeGeometryError, setRouteGeometryError] = useState<string | null>(
    null,
  );
  const routeGeometriesRef = useRef<Map<number, RouteGeometry>>(new Map());
  const routeGeometrySignaturesRef = useRef<Map<number, string>>(new Map());
  // Optimistic placeholder segments only exist client-side; fetching their
  // geometry would hit the server with ids it has never stored.
  const persistedSegments = useMemo(
    () =>
      snapshot.routeSegments.filter(
        (segment) => !isOptimisticSegmentId(segment.id),
      ),
    [snapshot.routeSegments],
  );
  const routeGeometrySignature = useMemo(
    () =>
      buildRouteGeometrySignature(persistedSegments, snapshot.itineraryItems),
    [persistedSegments, snapshot.itineraryItems],
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const itemsById = new Map(
      snapshot.itineraryItems.map((item) => [item.id, item]),
    );
    const nextSignatures = new Map(
      persistedSegments.map((segment) => [
        segment.id,
        routeGeometryRequestSignature(segment, itemsById),
      ]),
    );
    const nextSegmentIds = new Set(nextSignatures.keys());
    const staleSegmentIds = new Set(
      persistedSegments
        .filter(
          (segment) =>
            routeGeometrySignaturesRef.current.get(segment.id) !==
            nextSignatures.get(segment.id),
        )
        .map((segment) => segment.id),
    );

    const storage = getRouteGeometryBrowserCacheStorage();
    pruneRouteGeometryBrowserCache({
      storage,
      tripId,
      signatures: nextSignatures,
    });
    const prunedRouteGeometries = pruneRouteGeometries(
      routeGeometriesRef.current,
      nextSegmentIds,
      staleSegmentIds,
    );
    const cachedRouteGeometries = readRouteGeometryBrowserCache({
      storage,
      tripId,
      signatures: nextSignatures,
    });
    const hydratedRouteGeometries = mergeRouteGeometries(
      prunedRouteGeometries,
      cachedRouteGeometries,
    );
    if (hydratedRouteGeometries !== routeGeometriesRef.current) {
      routeGeometriesRef.current = hydratedRouteGeometries;
      setRouteGeometries(hydratedRouteGeometries);
    }

    if (persistedSegments.length === 0) {
      routeGeometrySignaturesRef.current.clear();
      setRouteGeometryError(null);
      controller.abort();
      return;
    }

    const missingSegmentIds = persistedSegments
      .map((segment) => segment.id)
      .filter((segmentId) => !hydratedRouteGeometries.has(segmentId));

    if (missingSegmentIds.length === 0) {
      routeGeometrySignaturesRef.current = nextSignatures;
      return;
    }

    routeGeometrySignaturesRef.current = nextSignatures;
    setRouteGeometryError(null);
    let firstError: string | null = null;

    void loadRouteGeometries({
      segmentIds: missingSegmentIds,
      signal: controller.signal,
      fetchGeometry: (segmentId, signal) =>
        fetchRouteGeometry(tripId, segmentId, signal),
      onResult: ({ geometry, error }) => {
        if (cancelled) return;

        if (error && !firstError) {
          firstError = error;
          setRouteGeometryError(error);
        }

        if (!geometry) return;
        setRouteGeometries((current) => {
          if (
            cancelled ||
            routeGeometrySignaturesRef.current.get(geometry.segment_id) !==
              nextSignatures.get(geometry.segment_id)
          ) {
            return current;
          }

          const currentGeometry = current.get(geometry.segment_id);
          if (currentGeometry === geometry) return current;

          writeRouteGeometryBrowserCache({
            storage,
            tripId,
            signature: nextSignatures.get(geometry.segment_id),
            geometry,
          });

          const next = new Map(current);
          next.set(geometry.segment_id, geometry);
          routeGeometriesRef.current = next;
          return next;
        });
      },
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [routeGeometrySignature, persistedSegments, tripId]);

  return { routeGeometries, routeGeometryError };
}

function pruneRouteGeometries(
  current: Map<number, RouteGeometry>,
  nextSegmentIds: Set<number>,
  staleSegmentIds: Set<number>,
): Map<number, RouteGeometry> {
  let next: Map<number, RouteGeometry> | null = null;

  for (const segmentId of current.keys()) {
    if (!nextSegmentIds.has(segmentId) || staleSegmentIds.has(segmentId)) {
      next ??= new Map(current);
      next.delete(segmentId);
    }
  }

  return next ?? current;
}

function mergeRouteGeometries(
  current: Map<number, RouteGeometry>,
  cached: Map<number, RouteGeometry>,
): Map<number, RouteGeometry> {
  let next: Map<number, RouteGeometry> | null = null;

  for (const [segmentId, geometry] of cached) {
    if (!current.has(segmentId)) {
      next ??= new Map(current);
      next.set(segmentId, geometry);
    }
  }

  return next ?? current;
}

function buildRouteGeometrySignature(
  routeSegments: PlannerSnapshot["routeSegments"],
  items: PlannerSnapshot["itineraryItems"],
): string {
  const itemsById = new Map(items.map((item) => [item.id, item]));

  return routeSegments
    .map((segment) => routeGeometryRequestSignature(segment, itemsById))
    .join(";");
}

function routeGeometryRequestSignature(
  segment: PlannerSnapshot["routeSegments"][number],
  itemsById: Map<number, PlannerSnapshot["itineraryItems"][number]>,
): string {
  return routeGeometryBrowserCacheSignature(segment, itemsById);
}
