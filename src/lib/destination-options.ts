import { DESTINATIONS } from "../data/destinations";

export type DestinationOption = {
  slug: string;
  name: string;
  countryCode: string;
  imagePath: string;
};

export const DESTINATION_OPTIONS: DestinationOption[] = DESTINATIONS.map(
  (destination) => ({
    ...destination,
    imagePath: destinationImagePath(destination.slug),
  }),
);

export function filterDestinationOptions(query: string): DestinationOption[] {
  const normalizedQuery = normalizeDestinationText(query);
  if (!normalizedQuery) {
    return sortDestinationOptions(DESTINATION_OPTIONS);
  }

  return sortDestinationOptions(
    DESTINATION_OPTIONS.filter((option) =>
      destinationSearchText(option).includes(normalizedQuery),
    ),
  );
}

export function findDestinationOption(
  value: string | null | undefined,
): DestinationOption | null {
  const normalizedValue = normalizeDestinationText(value);
  if (!normalizedValue) return null;

  return (
    DESTINATION_OPTIONS.find((option) => {
      const normalizedName = normalizeDestinationText(option.name);
      const normalizedSlug = normalizeDestinationText(option.slug);
      return (
        normalizedName === normalizedValue || normalizedSlug === normalizedValue
      );
    }) ?? null
  );
}

export function normalizeDestinationText(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function destinationSearchText(option: DestinationOption): string {
  return [option.name, option.slug]
    .map((value) => normalizeDestinationText(value))
    .join(" ");
}

function destinationImagePath(slug: string): string {
  return `/city-covers/${slug}.webp`;
}

function sortDestinationOptions(
  options: DestinationOption[],
): DestinationOption[] {
  return [...options].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}
