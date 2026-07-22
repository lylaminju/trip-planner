import type { AiDestinationCandidate } from "@/lib/types";

// Rotating "meanwhile" cards on the AI generation screen. They reuse the
// destination catalog already loaded during the wizard, so the wait surfaces
// the traveler's own must-sees — or, when they picked none, the destination's
// top spots — with no extra Places/OpenAI calls.
export const SPOTLIGHT_MAX_CARDS = 6;
export const SPOTLIGHT_ROTATE_MS = 5000;

export type GenerationSpotlight = {
  items: AiDestinationCandidate[];
  // True when the cards are the traveler's own selections, false when they are
  // the popular fallback. Drives the card eyebrow label.
  fromSelection: boolean;
};

// Chosen must-sees first (in selection order); fall back to the top catalog
// spots by sort order when nothing was selected. Bounded so the carousel stays
// short enough to loop within a typical generation.
export function selectSpotlightCandidates(
  candidates: AiDestinationCandidate[],
  selectedIds: number[],
  max = SPOTLIGHT_MAX_CARDS,
): GenerationSpotlight {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const selected = selectedIds
    .map((id) => byId.get(id))
    .filter((candidate): candidate is AiDestinationCandidate =>
      Boolean(candidate),
    );

  if (selected.length > 0) {
    return { items: selected.slice(0, max), fromSelection: true };
  }

  const popular = [...candidates].sort(
    (first, second) => first.sort_order - second.sort_order,
  );
  return { items: popular.slice(0, max), fromSelection: false };
}
