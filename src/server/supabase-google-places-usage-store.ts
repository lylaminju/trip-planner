import { getSupabaseClient } from "./supabase";
import { throwSupabaseError } from "./supabase-errors";

export const PLACES_SKU = {
  AUTOCOMPLETE: "autocomplete",
  DETAILS: "details",
  PHOTO: "photo",
} as const;

export type PlacesSku = (typeof PLACES_SKU)[keyof typeof PLACES_SKU];

// Google's free tier is per-SKU per-month and account-wide. We keep an internal
// ceiling below the real free limit (5,000 details / 10,000 autocomplete) so a
// burst near the boundary can never spill into paid usage.
export const PLACES_DETAILS_MONTHLY_LIMIT = 4500;
export const PLACES_AUTOCOMPLETE_MONTHLY_LIMIT = 9000;
// Place Photo has a much smaller (~1,000/month) free allotment than the other
// SKUs, so keep the internal ceiling well under it.
export const PLACES_PHOTO_MONTHLY_LIMIT = 900;

// Per-user daily soft cap so one user cannot drain the shared monthly budget.
export const PLACES_PER_USER_DAILY_LIMIT = 200;

const MONTHLY_LIMIT_BY_SKU: Record<PlacesSku, number> = {
  [PLACES_SKU.AUTOCOMPLETE]: PLACES_AUTOCOMPLETE_MONTHLY_LIMIT,
  [PLACES_SKU.DETAILS]: PLACES_DETAILS_MONTHLY_LIMIT,
  [PLACES_SKU.PHOTO]: PLACES_PHOTO_MONTHLY_LIMIT,
};

export function monthlyLimitForSku(sku: PlacesSku): number {
  return MONTHLY_LIMIT_BY_SKU[sku];
}

export async function countPlacesCallsThisMonth(
  sku: PlacesSku,
): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { count, error } = await getSupabaseClient()
    .from("google_places_api_calls")
    .select("*", { count: "exact", head: true })
    .eq("sku", sku)
    .gte("called_at", monthStart.toISOString());

  if (error) throwSupabaseError(error);
  return count ?? 0;
}

export async function countUserPlacesCallsToday(
  userId: string,
): Promise<number> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const { count, error } = await getSupabaseClient()
    .from("google_places_api_calls")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("called_at", dayStart.toISOString());

  if (error) throwSupabaseError(error);
  return count ?? 0;
}

export async function recordPlacesCall(
  userId: string,
  sku: PlacesSku,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("google_places_api_calls")
    .insert({ user_id: userId, sku });

  if (error) throwSupabaseError(error);
}
