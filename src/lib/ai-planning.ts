export const AI_SUPPORTED_DESTINATION_SLUGS = [
  "new-york-city",
  "banff-national-park",
  "los-angeles",
] as const;

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
