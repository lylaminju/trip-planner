import { getSupabaseClient } from "./supabase";

export const GOOGLE_ROUTES_DAILY_LIMIT = 200;

export async function countUserGoogleRoutesCallsToday(
  userId: string,
): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count, error } = await getSupabaseClient()
    .from("google_routes_api_calls")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("called_at", todayStart.toISOString());

  if (error) throwSupabaseError(error);
  return count ?? 0;
}

export async function recordGoogleRoutesCall(userId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("google_routes_api_calls")
    .insert({ user_id: userId });

  if (error) throwSupabaseError(error);
}

function throwSupabaseError(error: { message: string }): never {
  throw new Error(`Supabase query failed: ${error.message}`);
}
