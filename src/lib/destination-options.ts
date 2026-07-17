import { DESTINATIONS } from "../data/destinations";
import { isAiPlanningDestinationSupported } from "./ai-planning";

export type DestinationOption = {
  slug: string;
  name: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  zoom: number;
  imagePath: string;
};

export type DestinationFocus = {
  latitude: number;
  longitude: number;
  zoom: number;
};

// City-level zoom used when a trip has custom Google Maps coordinates but no
// curated destination preset to supply a tailored zoom.
export const DEFAULT_DESTINATION_ZOOM = 11;

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

export function findDestinationFocus(
  value: string | null | undefined,
): DestinationFocus | null {
  const option = findDestinationOption(value);
  if (!option) return null;

  return {
    latitude: option.latitude,
    longitude: option.longitude,
    zoom: option.zoom,
  };
}

const COUNTRY_NAME_FORMATTER = new Intl.DisplayNames(["en"], {
  type: "region",
});

export function countryNameFromCode(
  countryCode: string | null | undefined,
): string | null {
  if (!countryCode) return null;

  try {
    return COUNTRY_NAME_FORMATTER.of(countryCode) ?? null;
  } catch {
    return null;
  }
}

export function countryLabelForDestination(
  value: string | null | undefined,
): string | null {
  return countryNameFromCode(findDestinationOption(value)?.countryCode);
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
  return [option.name, option.slug, countryNameFromCode(option.countryCode)]
    .map((value) => normalizeDestinationText(value))
    .join(" ");
}

function destinationImagePath(slug: string): string {
  return `/city-covers/${slug}.webp`;
}

function sortDestinationOptions(
  options: DestinationOption[],
): DestinationOption[] {
  return [...options].sort((first, second) => {
    const firstAiSupported = isAiPlanningDestinationSupported(first.slug);
    const secondAiSupported = isAiPlanningDestinationSupported(second.slug);
    if (firstAiSupported !== secondAiSupported) {
      return firstAiSupported ? -1 : 1;
    }

    return first.name.localeCompare(second.name);
  });
}
