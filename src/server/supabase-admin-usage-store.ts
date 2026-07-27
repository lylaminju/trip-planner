import {
  aggregateByDay,
  historyQueryStart,
  lastDatesInTimeZone,
  type DailyCount,
} from "@/lib/daily-counts";

import { getSupabaseClient } from "./supabase";
import { PLACES_SKU } from "./supabase-google-places-usage-store";

const USAGE_HISTORY_DAYS = 14;

export type { DailyCount };

export type UserUsageStats = {
  userId: string;
  email: string;
  lastSignInAt: string | null;
  googleRoutesByDay: DailyCount[];
  placesAutocompleteByDay: DailyCount[];
  placesDetailsByDay: DailyCount[];
  aiGenerationsByDay: DailyCount[];
};

export async function getAllUsersUsageStats(
  timeZone: string,
): Promise<UserUsageStats[]> {
  const dates = lastDatesInTimeZone(USAGE_HISTORY_DAYS, timeZone);
  const start = historyQueryStart(dates[0]).toISOString();

  const [usersResult, routesResult, placesResult, genResult] = await Promise.all([
    getSupabaseClient().auth.admin.listUsers({ perPage: 1000 }),
    getSupabaseClient()
      .from("google_routes_api_calls")
      .select("user_id, called_at")
      .gte("called_at", start),
    getSupabaseClient()
      .from("google_places_api_calls")
      .select("user_id, sku, called_at")
      .gte("called_at", start),
    getSupabaseClient()
      .from("ai_plan_generations")
      .select("created_by_user_id, created_at")
      .gte("created_at", start),
  ]);

  if (usersResult.error) throw new Error(`Failed to list users: ${usersResult.error.message}`);
  if (routesResult.error) throw new Error(`Failed to load routes usage: ${routesResult.error.message}`);
  if (placesResult.error) throw new Error(`Failed to load places usage: ${placesResult.error.message}`);
  if (genResult.error) throw new Error(`Failed to load generation usage: ${genResult.error.message}`);

  return usersResult.data.users.map((u) => ({
    userId: u.id,
    email: u.email ?? u.id,
    lastSignInAt: u.last_sign_in_at ?? null,
    googleRoutesByDay: aggregateByDay(
      (routesResult.data ?? []).filter((r) => r.user_id === u.id).map((r) => r.called_at as string),
      dates,
      timeZone,
    ),
    placesAutocompleteByDay: aggregateByDay(
      (placesResult.data ?? [])
        .filter((p) => p.user_id === u.id && p.sku === PLACES_SKU.AUTOCOMPLETE)
        .map((p) => p.called_at as string),
      dates,
      timeZone,
    ),
    placesDetailsByDay: aggregateByDay(
      (placesResult.data ?? [])
        .filter((p) => p.user_id === u.id && p.sku === PLACES_SKU.DETAILS)
        .map((p) => p.called_at as string),
      dates,
      timeZone,
    ),
    aiGenerationsByDay: aggregateByDay(
      (genResult.data ?? []).filter((g) => g.created_by_user_id === u.id).map((g) => g.created_at as string),
      dates,
      timeZone,
    ),
  }));
}
