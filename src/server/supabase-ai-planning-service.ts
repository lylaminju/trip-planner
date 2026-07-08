import type {
  AiDestinationCandidate,
  AiPlanningPreferenceInput,
  AiPlanningPreferences,
  TripLodging,
} from "@/lib/types";

import { TripValidationError } from "./errors";
import { resolveGoogleMapsUrl } from "./google-url-resolver";
import { getSupabaseClient } from "./supabase";

const AI_DESTINATION_CANDIDATE_COLUMNS =
  "id, destination_slug, name, category, tags, area, region_distance_tier, sort_order, latitude, longitude, google_place_id, typical_duration_minutes, indoor_outdoor, created_at, updated_at";
const TRIP_LODGING_COLUMNS =
  "id, trip_id, name, address, latitude, longitude, google_place_id, check_in_date, check_out_date, is_primary, created_at, updated_at";
const AI_PLANNING_PREFERENCES_COLUMNS =
  "trip_id, visits_per_day_min, visits_per_day_max, interest_tags, preferred_travel_modes, must_see_candidate_ids, created_at, updated_at";

export async function listDestinationCandidates(
  destinationSlug: string,
): Promise<AiDestinationCandidate[]> {
  const { data, error } = await getSupabaseClient()
    .from("ai_destination_candidates")
    .select(AI_DESTINATION_CANDIDATE_COLUMNS)
    .eq("destination_slug", destinationSlug)
    .order("sort_order", { ascending: true });

  if (error) throwSupabaseError(error);
  return (data ?? []) as AiDestinationCandidate[];
}

export async function getPrimaryLodging(
  tripId: number,
): Promise<TripLodging | null> {
  const { data, error } = await getSupabaseClient()
    .from("trip_lodgings")
    .select(TRIP_LODGING_COLUMNS)
    .eq("trip_id", tripId)
    .eq("is_primary", true)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return (data ?? null) as TripLodging | null;
}

export async function upsertPrimaryLodgingFromGoogleMapsUrl(
  tripId: number,
  rawUrl: string,
): Promise<TripLodging> {
  const resolved = await resolveGoogleMapsUrl(rawUrl);
  if (resolved.latitude === null || resolved.longitude === null) {
    throw new TripValidationError(
      "Lodging Google Maps URL must include coordinates.",
    );
  }

  return upsertPrimaryLodging(tripId, {
    name: resolved.name?.trim() || "Lodging",
    address: null,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    google_place_id: null,
  });
}

export async function getPlanningPreferences(
  tripId: number,
): Promise<AiPlanningPreferences | null> {
  const { data, error } = await getSupabaseClient()
    .from("ai_planning_preferences")
    .select(AI_PLANNING_PREFERENCES_COLUMNS)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return (data ?? null) as AiPlanningPreferences | null;
}

export async function upsertPlanningPreferences(
  tripId: number,
  input: AiPlanningPreferenceInput,
): Promise<AiPlanningPreferences> {
  const { data, error } = await getSupabaseClient()
    .from("ai_planning_preferences")
    .upsert({ trip_id: tripId, ...input }, { onConflict: "trip_id" })
    .select(AI_PLANNING_PREFERENCES_COLUMNS)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return data as AiPlanningPreferences;
}

async function upsertPrimaryLodging(
  tripId: number,
  input: {
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
    google_place_id: string | null;
  },
): Promise<TripLodging> {
  const existing = await getPrimaryLodging(tripId);
  const values = {
    trip_id: tripId,
    ...input,
    is_primary: true,
  };

  if (!existing) {
    const { data, error } = await getSupabaseClient()
      .from("trip_lodgings")
      .insert(values)
      .select(TRIP_LODGING_COLUMNS)
      .maybeSingle();

    if (error) throwSupabaseError(error);
    return data as TripLodging;
  }

  const { data, error } = await getSupabaseClient()
    .from("trip_lodgings")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("trip_id", tripId)
    .eq("id", existing.id)
    .select(TRIP_LODGING_COLUMNS)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return data as TripLodging;
}

function throwSupabaseError(error: { message: string }): never {
  throw new Error(`Supabase query failed: ${error.message}`);
}
