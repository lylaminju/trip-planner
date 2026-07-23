import { useEffect, useState } from "react";

import {
  GENERATION_PROGRESS_TICK_MS,
  trickleProgress,
} from "./generation-progress";

// Time-based estimate bar shown under the generation heading. It is a rough
// visual (aria-hidden) that never fills — the parent status region already
// announces "Creating itinerary" for assistive tech.
export function AiGenerationProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    const timer = setInterval(() => {
      setProgress(trickleProgress(performance.now() - startedAt));
    }, GENERATION_PROGRESS_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="ai-generation-progress" aria-hidden="true">
      <span
        className="ai-generation-progress-fill"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}
