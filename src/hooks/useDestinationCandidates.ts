import { useEffect, useState } from "react";

import { loadDestinationCandidates } from "@/lib/planner-api";
import type { AiDestinationCandidate } from "@/lib/types";

type DestinationCandidatesState = {
  candidates: AiDestinationCandidate[];
  isLoading: boolean;
};

// Attraction suggestions from the trip destination's candidate catalog
// (curated or AI-generated); empty when no catalog exists yet. Empty on load
// failure too — the suggestions are an optional enhancement, so errors never
// surface. isLoading lets the search popover show a pending row instead of
// nothing while the catalog is in flight.
export function useDestinationCandidates(
  tripId: number,
): DestinationCandidatesState {
  const [candidates, setCandidates] = useState<AiDestinationCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
  }, [tripId]);

  return { candidates, isLoading };
}
