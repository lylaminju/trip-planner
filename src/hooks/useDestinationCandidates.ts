import { useEffect, useState } from "react";

import { loadDestinationCandidates } from "@/lib/planner-api";
import type { AiDestinationCandidate } from "@/lib/types";

// Curated attraction suggestions for the trip's destination. Empty for
// destinations without a curated catalog, and on load failure — the
// suggestions are an optional enhancement, so errors never surface.
export function useDestinationCandidates(
  tripId: number,
): AiDestinationCandidate[] {
  const [candidates, setCandidates] = useState<AiDestinationCandidate[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadDestinationCandidates(tripId)
      .then((results) => {
        if (!cancelled) setCandidates(results);
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  return candidates;
}
