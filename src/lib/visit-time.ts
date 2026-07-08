import type { ItineraryItem } from "./types";

export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0"),
);

export const MINUTE_OPTIONS = ["00", "10", "20", "30", "40", "50"] as const;

const VISIT_TIME_STEP_MINUTES = 10;
const LATEST_GRID_MINUTE = 23 * 60 + 50;

export function hasVisitDate(
  item: ItineraryItem,
): item is ItineraryItem & { visit_date: string } {
  return typeof item.visit_date === "string" && item.visit_date.length > 0;
}

export function hasVisitTimeText(
  item: ItineraryItem | null,
): item is ItineraryItem & { visit_time: string } {
  return typeof item?.visit_time === "string" && item.visit_time.length > 0;
}

export function hasValidVisitTime(
  item: ItineraryItem | null,
): item is ItineraryItem & { visit_time: string } {
  return hasVisitTimeText(item) && parseVisitTime(item.visit_time) !== null;
}

export function parseVisitTime(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

export function formatVisitTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function roundVisitMinutesUpToGrid(minutes: number): number {
  if (!Number.isFinite(minutes)) {
    return minutes;
  }

  return Math.min(
    Math.ceil(minutes / VISIT_TIME_STEP_MINUTES) * VISIT_TIME_STEP_MINUTES,
    LATEST_GRID_MINUTE,
  );
}

export function splitVisitTime(value: string | null): [string, string] {
  if (!value) {
    return ["", ""];
  }

  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return ["", ""];
  }

  return [match[1], match[2]];
}

export function composeVisitTime(
  hour: string | null | undefined,
  minute: string | null | undefined,
): string | null {
  const trimmedHour = hour?.trim() ?? "";
  const trimmedMinute = minute?.trim() ?? "";

  if (!trimmedHour && !trimmedMinute) {
    return null;
  }

  if (!trimmedHour || !trimmedMinute) {
    return null;
  }

  return `${trimmedHour}:${trimmedMinute}`;
}
