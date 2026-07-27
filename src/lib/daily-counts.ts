// Day-bucketed count helpers shared by the admin dashboard aggregation stores.
// Buckets are calendar days in the viewer's timezone, passed from the browser.

export type DailyCount = { date: string; count: number };

const DAY_MS = 24 * 60 * 60 * 1000;
// Extra time fetched before the window's first local midnight so every viewer
// timezone (UTC-12 through UTC+14) fully covers its earliest local day;
// rows outside the charted dates are dropped during bucketing.
const QUERY_WINDOW_BUFFER_MS = DAY_MS;

const FALLBACK_TIME_ZONE = "UTC";
const MAX_TIME_ZONE_LENGTH = 64;

// The timezone arrives as an untrusted query parameter; fail closed to UTC on
// anything Intl does not recognize.
export function resolveTimeZone(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_TIME_ZONE_LENGTH
  ) {
    return FALLBACK_TIME_ZONE;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

// Returns a reusable formatter mapping a timestamp to the YYYY-MM-DD calendar
// day it falls on in the given timezone. Reuse the returned function across a
// batch: constructing Intl.DateTimeFormat per timestamp is far too slow.
export function dayKeyFormatter(timeZone: string): (date: Date) => string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return (date) => {
    const parts = formatter.formatToParts(date);
    const part = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
}

// The last `days` calendar dates in the given timezone, oldest first, ending
// on the viewer's current day. Day arithmetic runs on UTC midnights of the
// date strings, so DST transitions cannot skip or repeat a date.
export function lastDatesInTimeZone(days: number, timeZone: string): string[] {
  const todayKey = dayKeyFormatter(timeZone)(new Date());
  const [year, month, day] = todayKey.split("-").map(Number);
  const todayUtcMidnight = Date.UTC(year, month - 1, day);
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(new Date(todayUtcMidnight - i * DAY_MS).toISOString().slice(0, 10));
  }
  return dates;
}

// Earliest timestamp a store must fetch so bucketing can fill every charted
// date, whatever the viewer's UTC offset.
export function historyQueryStart(firstDate: string): Date {
  return new Date(
    new Date(`${firstDate}T00:00:00Z`).getTime() - QUERY_WINDOW_BUFFER_MS,
  );
}

export function aggregateByDay(
  timestamps: string[],
  dates: string[],
  timeZone: string,
): DailyCount[] {
  const toDayKey = dayKeyFormatter(timeZone);
  const countByDate = new Map<string, number>();
  for (const ts of timestamps) {
    const date = toDayKey(new Date(ts));
    countByDate.set(date, (countByDate.get(date) ?? 0) + 1);
  }
  return dates.map((date) => ({ date, count: countByDate.get(date) ?? 0 }));
}
