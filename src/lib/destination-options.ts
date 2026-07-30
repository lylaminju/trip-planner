import { DESTINATIONS } from "../data/destinations";

export type DestinationOption = {
  slug: string;
  name: string;
  countryCode: string;
  timezone: string;
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

// Fills a trip's destination coordinates and country codes from its curated
// preset when they are not already set. Preset trips are created storing only a
// slug, so this is applied at trip creation to make the stored columns the
// single source of truth for map focus and place-search scope (no read-time
// derivation needed downstream). A one-time migration backfills existing rows.
export function fillPresetTripGeo(trip: {
  destination_slug: string | null;
  destination: string;
  destination_latitude: number | null;
  destination_longitude: number | null;
  destination_country_codes: string[] | null;
}): {
  destination_latitude: number | null;
  destination_longitude: number | null;
  destination_country_codes: string[] | null;
} {
  const preset = findDestinationOption(
    trip.destination_slug ?? trip.destination,
  );
  return {
    destination_latitude: trip.destination_latitude ?? preset?.latitude ?? null,
    destination_longitude:
      trip.destination_longitude ?? preset?.longitude ?? null,
    destination_country_codes:
      trip.destination_country_codes ??
      (preset?.countryCode ? [preset.countryCode] : null),
  };
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

// Curated presets carry an IANA zone; trips created from a custom Google
// destination have none, and callers must treat null as "local time cannot be
// resolved to an instant" rather than guessing a zone.
export function findDestinationTimeZone(
  value: string | null | undefined,
): string | null {
  return findDestinationOption(value)?.timezone ?? null;
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
  return [...options].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}
