import {
  PLACES_AUTOCOMPLETE_MONTHLY_LIMIT,
  PLACES_DETAILS_MONTHLY_LIMIT,
  PLACES_PLACE_DETAILS_ENTERPRISE_MONTHLY_LIMIT,
  PLACES_PHOTO_MONTHLY_LIMIT,
} from "@/lib/api-limits";

import { getSupabaseClient } from "./supabase";
import { throwSupabaseError } from "./supabase-errors";

export const PLACES_SKU = {
  AUTOCOMPLETE: "autocomplete",
  DETAILS: "details",
  PHOTO: "photo",
  // Place Details with the Enterprise field mask, used to select AI lunch
  // picks; candidate names resolve to place ids via the free IDs-only search.
  PLACE_DETAILS_ENTERPRISE: "place_details_enterprise",
} as const;

export type PlacesSku = (typeof PLACES_SKU)[keyof typeof PLACES_SKU];

const MONTHLY_LIMIT_BY_SKU: Record<PlacesSku, number> = {
  [PLACES_SKU.AUTOCOMPLETE]: PLACES_AUTOCOMPLETE_MONTHLY_LIMIT,
  [PLACES_SKU.DETAILS]: PLACES_DETAILS_MONTHLY_LIMIT,
  [PLACES_SKU.PHOTO]: PLACES_PHOTO_MONTHLY_LIMIT,
  [PLACES_SKU.PLACE_DETAILS_ENTERPRISE]:
    PLACES_PLACE_DETAILS_ENTERPRISE_MONTHLY_LIMIT,
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
