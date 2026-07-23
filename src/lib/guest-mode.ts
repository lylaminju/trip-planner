import {
  DESTINATION_OPTIONS,
  type DestinationOption,
} from "./destination-options";

// Guests may only plan destinations whose AI catalogs are already cached in
// ai_destination_candidates, so a guest session never triggers catalog
// generation, Google Places search, or transit-hub generation.
export const GUEST_DESTINATION_SLUGS: readonly string[] = [
  "bali",
  "banff-national-park",
  "iceland",
  "los-angeles",
  "new-york-city",
  "seoul",
  "toronto",
  "vancouver",
];

// Guest trips are short demos; longer trips require an invited account.
export const GUEST_TRIP_MAX_DAYS = 5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isGuestDestinationSlug(
  slug: string | null | undefined,
): boolean {
  return typeof slug === "string" && GUEST_DESTINATION_SLUGS.includes(slug);
}

export function guestDestinationOptions(): DestinationOption[] {
  return DESTINATION_OPTIONS.filter((option) =>
    GUEST_DESTINATION_SLUGS.includes(option.slug),
  );
}

// Inclusive day count; null when either date is missing.
export function tripLengthInDays(
  startDate: string | null,
  endDate: string | null,
): number | null {
  if (!startDate || !endDate) return null;

  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;

  return Math.round((endMs - startMs) / MS_PER_DAY) + 1;
}

export function exceedsGuestTripLength(
  startDate: string | null,
  endDate: string | null,
): boolean {
  const days = tripLengthInDays(startDate, endDate);
  return days !== null && days > GUEST_TRIP_MAX_DAYS;
}
