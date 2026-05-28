import { useEffect, useMemo, useRef, useState } from "react";

import { fetchRouteGeometry } from "@/lib/planner-api";
import type {
  ItineraryItem,
  PlannerSnapshot,
  RouteGeometry,
} from "@/lib/types";

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
  const routeGeometrySignaturesRef = useRef<Map<number, string>>(new Map());
  const routeGeometrySignature = useMemo(
    () =>
      buildRouteGeometrySignature(
        snapshot.routeSegments,
        snapshot.itineraryItems,
      ),
    [snapshot.routeSegments, snapshot.itineraryItems],
  );

  useEffect(() => {
    let cancelled = false;
    const itemsById = new Map(
      snapshot.itineraryItems.map((item) => [item.id, item]),
    );
    const nextSignatures = new Map(
      snapshot.routeSegments.map((segment) => [
        segment.id,
        routeGeometryRequestSignature(segment, itemsById),
      ]),
    );
    const nextSegmentIds = new Set(nextSignatures.keys());
    const staleSegmentIds = new Set(
      snapshot.routeSegments
        .filter(
          (segment) =>
            routeGeometrySignaturesRef.current.get(segment.id) !==
            nextSignatures.get(segment.id),
        )
        .map((segment) => segment.id),
    );

    setRouteGeometries((current) => {
      const next = new Map(current);
      let changed = false;
      for (const segmentId of current.keys()) {
        if (!nextSegmentIds.has(segmentId) || staleSegmentIds.has(segmentId)) {
          next.delete(segmentId);
          changed = true;
        }
      }
      return changed ? next : current;
    });

    if (snapshot.routeSegments.length === 0) {
      routeGeometrySignaturesRef.current.clear();
      setRouteGeometryError(null);
      return;
    }

    const missingSegmentIds = snapshot.routeSegments
      .map((segment) => segment.id)
      .filter(
        (segmentId) =>
          staleSegmentIds.has(segmentId) || !routeGeometries.has(segmentId),
      );

    if (missingSegmentIds.length === 0) {
      routeGeometrySignaturesRef.current = nextSignatures;
      return;
    }

    routeGeometrySignaturesRef.current = nextSignatures;

    void Promise.all(
      missingSegmentIds.map((segmentId) =>
        fetchRouteGeometry(tripId, segmentId),
      ),
    ).then((results) => {
      if (cancelled) return;

      setRouteGeometryError(
        results.find((result) => result.error)?.error ?? null,
      );
      setRouteGeometries((current) => {
        const next = new Map(current);
        let changed = false;

        for (const { geometry } of results) {
          if (!geometry) continue;
          next.set(geometry.segment_id, geometry);
          changed = true;
        }

        return changed ? next : current;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [routeGeometrySignature, routeGeometries, snapshot.routeSegments, tripId]);

  return { routeGeometries, routeGeometryError };
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
  itemsById: Map<number, ItineraryItem>,
): string {
  const from = itemsById.get(segment.from_item_id);
  const to = itemsById.get(segment.to_item_id);
  return [
    segment.id,
    segment.mode,
    from?.place.latitude ?? "",
    from?.place.longitude ?? "",
    to?.place.latitude ?? "",
    to?.place.longitude ?? "",
  ].join(":");
}
