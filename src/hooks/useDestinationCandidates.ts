import { useEffect, useState } from "react";

import { loadDestinationCandidates } from "@/lib/planner-api";
import type { AiDestinationCandidate } from "@/lib/types";

type DestinationCandidatesState = {
  candidates: AiDestinationCandidate[];
  isLoading: boolean;
};

// Curated attraction suggestions for the trip's destination. Empty on load
// failure — the suggestions are an optional enhancement, so errors never
// surface. isLoading lets the search popover show a pending row instead of
// nothing while the catalog is in flight. Pass enabled=false for
// destinations without a curated catalog: the fetch is skipped entirely so
// the popover never opens, not even with a pending row.
export function useDestinationCandidates(
  tripId: number,
  enabled: boolean,
): DestinationCandidatesState {
  const [candidates, setCandidates] = useState<AiDestinationCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setIsLoading(true);
    loadDestinationCandidates(tripId)
      .then((results) => {
        if (!cancelled) setCandidates(results);
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, enabled]);

  return { candidates, isLoading: enabled && isLoading };
}
