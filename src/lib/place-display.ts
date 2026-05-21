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

export function formatSchedule(item: ItineraryItem): string {
  if (item.visit_date && item.visit_time)
    return `${item.visit_date} ${item.visit_time}`;
  if (item.visit_date) return item.visit_date;
  return "Unscheduled";
}

export function formatItineraryDateHeading(date: string): string {
  const parsedDate = new Date(`${date}T00:00:00Z`);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
  }).format(parsedDate);

  return `${date} ${weekday}`;
}

function hasNestedPlace(source: PlaceRowSource): source is ItineraryItem {
  return (
    "place" in source &&
    typeof source.place === "object" &&
    source.place !== null
  );
}
