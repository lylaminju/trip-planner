import {
  aggregateByDay,
  dayKeyFormatter,
  historyQueryStart,
  lastDatesInTimeZone,
  type DailyCount,
} from "@/lib/daily-counts";

import { GUEST_EVENT_NAMES, type GuestEventName } from "./guest-events";
import { getSupabaseClient } from "./supabase";

const GUEST_ACTIVITY_HISTORY_DAYS = 14;

export type GuestEventRow = {
  guest_id: string;
  event_name: string;
  created_at: string;
};

export type GuestActivityStats = {
  activeGuestsByDay: DailyCount[];
  eventCharts: { eventName: GuestEventName; byDay: DailyCount[] }[];
};

// Pure aggregation, exported so tests exercise the production logic without a
// Supabase client. Rows with unknown event names still count as guest activity
// but get no chart of their own.
export function aggregateGuestActivity(
  rows: GuestEventRow[],
  dates: string[],
  timeZone: string,
): GuestActivityStats {
  const toDayKey = dayKeyFormatter(timeZone);
  const guestsByDate = new Map<string, Set<string>>();
  for (const row of rows) {
    const date = toDayKey(new Date(row.created_at));
    const guests = guestsByDate.get(date) ?? new Set<string>();
    guests.add(row.guest_id);
    guestsByDate.set(date, guests);
  }

  return {
    activeGuestsByDay: dates.map((date) => ({
      date,
      count: guestsByDate.get(date)?.size ?? 0,
    })),
    eventCharts: GUEST_EVENT_NAMES.map((eventName) => ({
      eventName,
      byDay: aggregateByDay(
        rows.filter((row) => row.event_name === eventName).map((row) => row.created_at),
        dates,
        timeZone,
      ),
    })),
  };
}

export async function getGuestActivityStats(
  timeZone: string,
): Promise<GuestActivityStats> {
  const dates = lastDatesInTimeZone(GUEST_ACTIVITY_HISTORY_DAYS, timeZone);

  const { data, error } = await getSupabaseClient()
    .from("guest_events")
    .select("guest_id, event_name, created_at")
    .gte("created_at", historyQueryStart(dates[0]).toISOString());

  if (error) throw new Error(`Failed to load guest events: ${error.message}`);

  return aggregateGuestActivity((data ?? []) as GuestEventRow[], dates, timeZone);
}
