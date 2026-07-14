export const AI_SUPPORTED_DESTINATION_SLUGS = [
  "new-york-city",
  "banff-national-park",
  "los-angeles",
  "toronto",
  "iceland",
] as const;

export const AI_OPENING_HOURS_WARNING =
  "AI itinerary created. Opening hours may change, so check Google Maps or the venue before you go.";

const AI_SUPPORTED_DESTINATION_SLUG_SET = new Set<string>(
  AI_SUPPORTED_DESTINATION_SLUGS,
);

export function isAiPlanningDestinationSupported(
  destinationSlug: string | null | undefined,
): boolean {
  return destinationSlug
    ? AI_SUPPORTED_DESTINATION_SLUG_SET.has(destinationSlug)
    : false;
}
