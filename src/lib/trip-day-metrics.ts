import { todayIsoDate } from "./trip-classification";
import type { TripSummary } from "./types";

const MS_PER_DAY = 86_400_000;

type TripDates = Pick<TripSummary, "start_date" | "end_date">;

function isoToUtcMs(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getTime();
}

/** Total inclusive length of a dated trip, or null when dates are missing/invalid. */
export function tripDurationDays(trip: TripDates): number | null {
  if (!trip.start_date || !trip.end_date) return null;

  const start = isoToUtcMs(trip.start_date);
  const end = isoToUtcMs(trip.end_date);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }

  return Math.round((end - start) / MS_PER_DAY) + 1;
}

/** 1-based day index within an ongoing trip, or null when today is outside it. */
export function tripDayOf(trip: TripDates, now = new Date()): number | null {
  if (!trip.start_date || !trip.end_date) return null;

  const today = isoToUtcMs(todayIsoDate(now));
  const start = isoToUtcMs(trip.start_date);
  const end = isoToUtcMs(trip.end_date);
  if (today < start || today > end) return null;

  return Math.round((today - start) / MS_PER_DAY) + 1;
}

/** Whole days from today until the trip starts, or null when the start is unset. */
export function daysUntilStart(trip: TripDates, now = new Date()): number | null {
  if (!trip.start_date) return null;

  const start = isoToUtcMs(trip.start_date);
  if (!Number.isFinite(start)) return null;

  return Math.round((start - isoToUtcMs(todayIsoDate(now))) / MS_PER_DAY);
}

/** K-style countdown chip label, e.g. "D-40", "D-DAY". */
export function countdownLabel(daysUntil: number): string {
  return daysUntil <= 0 ? "D-DAY" : `D-${daysUntil}`;
}
