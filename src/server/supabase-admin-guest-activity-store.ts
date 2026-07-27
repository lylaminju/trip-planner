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
// but get no chart of their own. Internal guests (developer browsers listed in
// internal_guests) are excluded before any counting.
export function aggregateGuestActivity(
  allRows: GuestEventRow[],
  dates: string[],
  timeZone: string,
  internalGuestIds: ReadonlySet<string> = new Set(),
): GuestActivityStats {
  const rows = allRows.filter((row) => !internalGuestIds.has(row.guest_id));
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

  const [events, internal] = await Promise.all([
    getSupabaseClient()
      .from("guest_events")
      .select("guest_id, event_name, created_at")
      .gte("created_at", historyQueryStart(dates[0]).toISOString()),
    getSupabaseClient().from("internal_guests").select("guest_id"),
  ]);

  if (events.error) {
    throw new Error(`Failed to load guest events: ${events.error.message}`);
  }
  if (internal.error) {
    throw new Error(`Failed to load internal guests: ${internal.error.message}`);
  }

  const internalGuestIds = new Set(
    ((internal.data ?? []) as { guest_id: string }[]).map((row) => row.guest_id),
  );

  return aggregateGuestActivity(
    (events.data ?? []) as GuestEventRow[],
    dates,
    timeZone,
    internalGuestIds,
  );
}
