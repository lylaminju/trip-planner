export type DestinationOption = {
  slug: string;
  name: string;
  imagePath: string;
  aliases: string[];
};

export const DESTINATION_OPTIONS: DestinationOption[] = [
  {
    slug: "new-york-city",
    name: "New York City",
    imagePath: "/city-covers/new-york-city.webp",
    aliases: ["new york", "new york city", "nyc"],
  },
  {
    slug: "los-angeles",
    name: "Los Angeles",
    imagePath: "/city-covers/los-angeles.webp",
    aliases: ["la", "los angeles", "los angeles ca"],
  },
  {
    slug: "san-francisco",
    name: "San Francisco",
    imagePath: "/city-covers/san-francisco.webp",
    aliases: ["san francisco", "sf", "san francisco ca"],
  },
  {
    slug: "toronto",
    name: "Toronto",
    imagePath: "/city-covers/toronto.webp",
    aliases: ["toronto", "toronto on"],
  },
  {
    slug: "banff-national-park",
    name: "Banff National Park",
    imagePath: "/city-covers/banff-national-park.webp",
    aliases: ["banff", "banff national park"],
  },
];

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
      return (
        normalizedName === normalizedValue ||
        option.aliases.some(
          (alias) => normalizeDestinationText(alias) === normalizedValue,
        )
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
  return [option.name, option.slug, ...option.aliases]
    .map((value) => normalizeDestinationText(value))
    .join(" ");
}

function sortDestinationOptions(
  options: DestinationOption[],
): DestinationOption[] {
  return [...options].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}
