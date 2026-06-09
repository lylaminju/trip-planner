import type { Trip } from "./types";

export function formatTripPeriodLabel(trip: Trip | null): string | null {
  if (!trip?.start_date && !trip?.end_date) return null;
  if (trip.start_date && trip.end_date) {
    return formatDateRange(trip.start_date, trip.end_date);
  }

  if (trip.start_date) {
    return `Starts ${formatFullDate(trip.start_date)}`;
  }

  if (trip.end_date) {
    return `Ends ${formatFullDate(trip.end_date)}`;
  }

  return null;
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = parseIsoDateParts(startDate);
  const end = parseIsoDateParts(endDate);

  if (!start || !end) return `${startDate} to ${endDate}`;
  if (startDate === endDate) return formatFullDate(startDate);

  if (start.year === end.year && start.month === end.month) {
    return `${formatMonthDay(startDate)} - ${end.day}, ${end.year}`;
  }

  if (start.year === end.year) {
    return `${formatMonthDay(startDate)} - ${formatMonthDay(endDate)}, ${end.year}`;
  }

  return `${formatFullDate(startDate)} - ${formatFullDate(endDate)}`;
}

function formatMonthDay(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatFullDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function parseIsoDateParts(
  value: string,
): { year: number; month: number; day: number } | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  return { year, month, day };
}
