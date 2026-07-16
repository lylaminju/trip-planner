import type { ItineraryItem, Place } from "@/lib/types";

type PlaceRowContext = "default" | "itinerary";
type PlaceRowSource = Place | ItineraryItem;

export type PlaceRowDisplay = {
  title: string;
  detail: string | null;
  timePrefix: string | null;
};

export function formatPlaceRow(
  source: PlaceRowSource,
  options: { context?: PlaceRowContext } = {},
): PlaceRowDisplay {
  const isItineraryItem = hasNestedPlace(source);
  const place = isItineraryItem ? source.place : source;

  if (options.context === "itinerary") {
    return {
      title: place.name,
      detail: null,
      timePrefix: isItineraryItem ? (source.visit_time ?? null) : null,
    };
  }

  return {
    title: place.name,
    detail: isItineraryItem ? formatSchedule(source) : null,
    timePrefix: null,
  };
}

// First character used as the thumbnail fallback monogram. Destructuring a
// string iterates by code point, so a leading emoji (a surrogate pair) stays
// whole instead of being sliced into a lone surrogate — a lone surrogate
// serializes to U+FFFD on the server but survives on the client, breaking
// hydration.
export function placeInitial(name: string): string {
  const [first] = name.trim();
  return (first ?? "").toUpperCase();
}

export function formatSchedule(item: ItineraryItem): string {
  if (item.visit_date && item.visit_time)
    return `${item.visit_date} ${item.visit_time}`;
  if (item.visit_date) return item.visit_date;
  return "Unscheduled";
}

export function formatItineraryDateHeading(date: string): string {
  const parsedDate = new Date(`${date}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parsedDate);
}

function hasNestedPlace(source: PlaceRowSource): source is ItineraryItem {
  return (
    "place" in source &&
    typeof source.place === "object" &&
    source.place !== null
  );
}
