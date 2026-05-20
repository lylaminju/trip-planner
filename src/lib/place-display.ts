import type { Place } from "@/lib/types";

type PlaceRowContext = "default" | "itinerary";

export type PlaceRowDisplay = {
  title: string;
  detail: string | null;
  timePrefix: string | null;
};

export function formatPlaceRow(
  place: Place,
  options: { context?: PlaceRowContext } = {},
): PlaceRowDisplay {
  if (options.context === "itinerary") {
    return {
      title: place.name,
      detail: null,
      timePrefix: place.visit_time ?? null,
    };
  }

  return {
    title: place.name,
    detail: formatSchedule(place),
    timePrefix: null,
  };
}

export function formatSchedule(place: Place): string {
  if (place.visit_date && place.visit_time) return `${place.visit_date} ${place.visit_time}`;
  if (place.visit_date) return place.visit_date;
  return place.address ?? "Unscheduled";
}

export function formatItineraryDateHeading(date: string): string {
  const parsedDate = new Date(`${date}T00:00:00Z`);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
  }).format(parsedDate);

  return `${date} ${weekday}`;
}
