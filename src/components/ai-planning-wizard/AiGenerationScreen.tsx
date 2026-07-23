import type { AiDestinationCandidate } from "@/lib/types";

import { AiGenerationProgress } from "./AiGenerationProgress";
import { AiGenerationSpotlight } from "./AiGenerationSpotlight";

export function AiGenerationScreen({
  destination,
  candidates,
  selectedIds,
}: {
  destination: string;
  candidates: AiDestinationCandidate[];
  selectedIds: number[];
}) {
  return (
    <div
      className="ai-generation-screen"
      role="status"
      aria-label="Creating itinerary"
    >
      <div className="ai-generation-copy">
        <h2 className="ai-generation-title">
          Building your {destination} itinerary
        </h2>
      </div>
      <AiGenerationProgress />
      <AiGenerationSpotlight
        candidates={candidates}
        selectedIds={selectedIds}
        destination={destination}
      />
    </div>
  );
}
