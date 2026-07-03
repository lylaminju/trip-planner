import type { RouteGeometry } from "@/lib/types";

type RouteGeometryResult = {
  geometry: RouteGeometry | null;
  error: string | null;
};

type LoadRouteGeometriesInput = {
  segmentIds: number[];
  signal: AbortSignal;
  fetchGeometry: (
    segmentId: number,
    signal: AbortSignal,
  ) => Promise<RouteGeometryResult>;
  onResult: (result: RouteGeometryResult) => void;
  concurrency?: number;
};

export const ROUTE_GEOMETRY_CONCURRENCY = 6;

export async function loadRouteGeometries({
  segmentIds,
  signal,
  fetchGeometry,
  onResult,
  concurrency = ROUTE_GEOMETRY_CONCURRENCY,
}: LoadRouteGeometriesInput): Promise<void> {
  if (segmentIds.length === 0 || concurrency <= 0 || signal.aborted) {
    return;
  }

  let nextIndex = 0;
  const workerCount = Math.min(concurrency, segmentIds.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (!signal.aborted) {
        const segmentId = segmentIds[nextIndex];
        nextIndex += 1;

        if (segmentId === undefined) return;

        const result = await fetchGeometry(segmentId, signal);
        if (signal.aborted) return;

        onResult(result);
      }
    }),
  );
}
