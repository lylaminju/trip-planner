import type { TripSummary } from "./types";

export const DEFAULT_VIEWER_TIMEZONE = "America/Toronto";

export type TripTimingGroups = {
  ongoing: TripSummary[];
  needsDates: TripSummary[];
  upcoming: TripSummary[];
  past: TripSummary[];
};

export function groupTripsByTiming(
  trips: TripSummary[],
  now = new Date(),
  viewerTimeZone = detectBrowserTimeZone(),
): TripTimingGroups {
  const groups: TripTimingGroups = {
    ongoing: [],
    needsDates: [],
    upcoming: [],
    past: [],
  };
  const today = localIsoDate(now, viewerTimeZone);

  for (const trip of trips) {
    if (!trip.start_date || !trip.end_date) {
      groups.needsDates.push(trip);
      continue;
    }

    if (trip.end_date < today) {
      groups.past.push(trip);
    } else if (trip.start_date > today) {
      groups.upcoming.push(trip);
    } else {
      groups.ongoing.push(trip);
    }
  }

  groups.past.sort((left, right) =>
    (right.end_date ?? "").localeCompare(left.end_date ?? ""),
  );

  return groups;
}

export function isTripOngoing(
  trip:
    | Pick<TripSummary, "start_date" | "end_date">
    | null
    | undefined,
  now = new Date(),
  viewerTimeZone = detectBrowserTimeZone(),
): boolean {
  if (!trip?.start_date || !trip.end_date) {
    return false;
  }

  const today = localIsoDate(now, viewerTimeZone);
  return trip.start_date <= today && trip.end_date >= today;
}

export function todayIsoDate(
  now = new Date(),
  viewerTimeZone = detectBrowserTimeZone(),
): string {
  return localIsoDate(now, viewerTimeZone);
}

export function detectBrowserTimeZone(): string {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timeZone === "string" && timeZone.trim()
      ? timeZone
      : DEFAULT_VIEWER_TIMEZONE;
  } catch {
    return DEFAULT_VIEWER_TIMEZONE;
  }
}

function localIsoDate(now: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return now.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}
