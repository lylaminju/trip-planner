import type { AiTransitHubType } from "./types";

// Emoji stand-in for a place thumbnail that has no photo. AI planning creates
// anchor places -- transit hubs and lodging -- that never resolve a photo, so
// they show a type emoji instead of the name-initial monogram used elsewhere.
const TRANSIT_HUB_FALLBACK_EMOJI: Record<AiTransitHubType, string> = {
  airport: "✈️",
  train_station: "🚆",
  bus_terminal: "🚌",
  ferry_terminal: "⛴️",
};

export const LODGING_FALLBACK_EMOJI = "🏨";

// Null for a custom transit point whose hub type is unknown; the thumbnail then
// falls back to the name initial like any other place.
export function transitHubFallbackEmoji(
  hubType: AiTransitHubType | null,
): string | null {
  return hubType ? TRANSIT_HUB_FALLBACK_EMOJI[hubType] : null;
}
