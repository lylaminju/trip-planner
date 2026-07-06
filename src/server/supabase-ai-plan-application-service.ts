import type {
  AiDestinationCandidate,
  AiPlanningPreferenceInput,
  PlannerSnapshot,
} from "@/lib/types";

import { getSupabaseClient } from "./supabase";
import { getPlannerSnapshot } from "./supabase-place-service";
import type { AiItineraryPlan } from "./openai-ai-planner";

type GenerationRecord = {
  id: number;
};

type GenerationInsert = {
  prompt_version: string;
  preferences_snapshot: Record<string, unknown>;
  candidate_count: number;
  must_see_count: number;
  status?: "running" | "completed" | "failed";
};

type GenerationUpdate = {
  status?: "running" | "completed" | "failed";
  model?: string;
  primary_validation_status?: "valid" | "invalid";
  primary_validation_errors?: string[];
  repair_attempted?: boolean;
  repair_validation_status?: "valid" | "invalid" | "not_attempted";
  repair_validation_errors?: string[];
  generated_place_count?: number;
  generated_day_count?: number;
  duration_ms?: number;
  token_input_count?: number | null;
  token_output_count?: number | null;
  failure_reason?: string | null;
};

export async function createAiPlanGeneration(
  tripId: number,
  input: GenerationInsert,
): Promise<GenerationRecord> {
  const { data, error } = await getSupabaseClient()
    .from("ai_plan_generations")
    .insert({
      trip_id: tripId,
      status: input.status ?? "running",
      prompt_version: input.prompt_version,
      preferences_snapshot: input.preferences_snapshot,
      candidate_count: input.candidate_count,
      must_see_count: input.must_see_count,
    })
    .select("id")
    .single();

  if (error) throwSupabaseError(error);
  return data as GenerationRecord;
}

export async function updateAiPlanGeneration(
  generationId: number,
  input: GenerationUpdate,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("ai_plan_generations")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", generationId);

  if (error) throwSupabaseError(error);
}

export async function replaceAiGeneratedBatch(
  tripId: number,
  generationId: number,
  plan: AiItineraryPlan,
  candidates: AiDestinationCandidate[],
  preferences: AiPlanningPreferenceInput,
): Promise<PlannerSnapshot> {
  await deletePreviousAiBatch(tripId);

  const candidateById = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );
  const visits = plan.days.flatMap((day) =>
    day.visits.map((visit) => ({ date: day.date, visit })),
  );

  const placeRows = visits.map(({ visit }) => {
    const candidate = candidateById.get(visit.candidate_id);
    if (!candidate) {
      throw new Error(`Candidate ${visit.candidate_id} is not available.`);
    }

    return {
      trip_id: tripId,
      name: candidate.name,
      address: candidate.area,
      google_maps_url: googleMapsSearchUrl(candidate),
      place_id: candidate.google_place_id,
      google_place_token: null,
      google_internal_ids: null,
      source_list_url: null,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      notes: visit.notes,
      links: [],
      created_by_source: "ai",
      ai_generation_id: generationId,
    };
  });

  if (placeRows.length === 0) {
    return getPlannerSnapshot(tripId);
  }

  const { data: places, error: placeError } = await getSupabaseClient()
    .from("places")
    .insert(placeRows)
    .select("id");

  if (placeError) throwSupabaseError(placeError);

  const placeIds = ((places ?? []) as Array<{ id: number }>).map(
    (place) => place.id,
  );
  const itemRows = visits.map(({ date, visit }, index) => ({
    trip_id: tripId,
    place_id: placeIds[index],
    visit_date: date,
    visit_time: visit.start_time,
    notes: visit.notes,
    created_by_source: "ai",
    ai_generation_id: generationId,
  }));

  const { data: items, error: itemError } = await getSupabaseClient()
    .from("itinerary_items")
    .insert(itemRows)
    .select("id");

  if (itemError) throwSupabaseError(itemError);

  await reconcileRoutesForTrip(tripId);
  await tagGeneratedRouteSegments(
    tripId,
    generationId,
    ((items ?? []) as Array<{ id: number }>).map((item) => item.id),
    preferences.preferred_travel_modes[0] ?? "walking",
  );

  return getPlannerSnapshot(tripId);
}

async function deletePreviousAiBatch(tripId: number): Promise<void> {
  for (const table of ["route_segments", "itinerary_items", "places"]) {
    const { error } = await getSupabaseClient()
      .from(table)
      .delete()
      .eq("trip_id", tripId)
      .eq("created_by_source", "ai");

    if (error) throwSupabaseError(error);
  }
}

async function reconcileRoutesForTrip(tripId: number): Promise<void> {
  const { error } = await getSupabaseClient().rpc(
    "reconcile_route_segments_for_trip",
    { p_trip_id: tripId },
  );

  if (error) throwSupabaseError(error);
}

async function tagGeneratedRouteSegments(
  tripId: number,
  generationId: number,
  itemIds: number[],
  mode: string,
): Promise<void> {
  if (itemIds.length < 2) return;

  const { error } = await getSupabaseClient()
    .from("route_segments")
    .update({
      created_by_source: "ai",
      ai_generation_id: generationId,
      mode,
      updated_at: new Date().toISOString(),
    })
    .eq("trip_id", tripId)
    .in("from_item_id", itemIds)
    .in("to_item_id", itemIds);

  if (error) throwSupabaseError(error);
}

function googleMapsSearchUrl(candidate: AiDestinationCandidate): string {
  const query = encodeURIComponent(`${candidate.latitude},${candidate.longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function throwSupabaseError(error: { message: string }): never {
  throw new Error(`Supabase query failed: ${error.message}`);
}
