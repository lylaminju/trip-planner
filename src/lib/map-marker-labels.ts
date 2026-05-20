import type { ItineraryItem, ItineraryView } from "@/lib/types";

export type MarkerSizing = {
  size: number;
  activeSize: number;
  fontSize: number;
  activeFontSize: number;
};

export function buildTimedMarkerLabels(itinerary: ItineraryView): Map<number, string> {
  const labels = new Map<number, string>();

  for (const day of itinerary.days) {
    let order = 1;

    for (const item of day.items) {
      if (!hasVisitTime(item)) {
        continue;
      }

      labels.set(item.id, String(order));
      order += 1;
    }
  }

  return labels;
}

export function getMarkerSizing(zoom: number | undefined): MarkerSizing {
  const normalizedZoom = zoom ?? 12;

  if (normalizedZoom >= 16) {
    return {
      size: 24,
      activeSize: 32,
      fontSize: 12,
      activeFontSize: 14,
    };
  }

  if (normalizedZoom >= 14) {
    return {
      size: 20,
      activeSize: 28,
      fontSize: 11,
      activeFontSize: 13,
    };
  }

  return {
    size: 16,
    activeSize: 22,
    fontSize: 10,
    activeFontSize: 12,
  };
}

function hasVisitTime(item: ItineraryItem): boolean {
  return typeof item.visit_time === "string" && item.visit_time.length > 0;
}
