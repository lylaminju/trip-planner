import { formatItineraryDateHeading } from "./place-display";
import type { ItineraryView } from "./types";

export function generateScheduledItineraryMarkdown(
  tripTitle: string,
  itinerary: ItineraryView,
): string {
  const lines = [`# ${tripTitle} Itinerary`, ""];

  if (itinerary.days.length === 0) {
    lines.push("No scheduled itinerary items yet.");
    return `${lines.join("\n")}\n`;
  }

  itinerary.days.forEach((day, dayIndex) => {
    if (dayIndex > 0) {
      lines.push("");
    }

    lines.push(`## ${formatItineraryDateHeading(day.date)}`, "");

    for (const item of day.items) {
      const prefix = item.visit_time ? `${item.visit_time} ` : "";
      lines.push(`### ${prefix}${item.place.name}`, "");

      if (item.place.google_maps_url) {
        lines.push(`- [Google Maps](${item.place.google_maps_url})`);
      }

      if (item.place.address) {
        lines.push(`- Address: ${item.place.address}`);
      }

      if (item.notes) {
        const noteLines = item.notes
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        if (noteLines.length > 0) {
          lines.push("- Note:");
          lines.push(...noteLines.map((line) => `  - ${line}`));
        }
      }

      for (const link of item.place.links) {
        const trimmedLink = link.trim();
        if (trimmedLink) {
          lines.push(`- ${trimmedLink}`);
        }
      }

      lines.push("");
    }
  });

  return `${lines.join("\n").trimEnd()}\n`;
}

export function buildExportFilename(tripTitle: string): string {
  const slug = tripTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "trip"}-itinerary.md`;
}
