import type {
  AiDestinationCandidate,
  AiPlanningPreferenceInput,
  PlannerSnapshot,
  TripLodging,
  TravelMode,
} from "@/lib/types";
import { AI_DEFAULT_DAILY_START_TIME } from "@/lib/ai-planning-preferences";

import {
  buildAiGeneratedPlaceRows,
  buildGeneratedScheduleEntries,
  type Coordinates,
} from "./ai-plan-batch-rows";
import { chooseAiRouteMode } from "./ai-route-mode-selection";
import { getSupabaseClient } from "./supabase";
import { getPlannerSnapshot } from "./supabase-place-service";
import type { AiItineraryPlan } from "./openai-ai-planner";
import { getRouteGeometry } from "./route-geometry-service";

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

type GeneratedVisitContext = {
  itemId: number;
  date: string;
  startTime: string;
  location: Coordinates;
  order: number;
};

type GeneratedRoutePair = {
  from: GeneratedVisitContext;
  to: GeneratedVisitContext;
};

type RouteSegmentRow = {
  id: number;
  from_item_id: number;
  to_item_id: number;
};

const AI_BATCH_TABLES = ["route_segments", "itinerary_items", "places"] as const;
const AI_ROUTE_MODE_WALKING_PROBE_LIMIT = 10;
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
  lodging: TripLodging | null = null,
  lodgingStartTime = AI_DEFAULT_DAILY_START_TIME,
): Promise<PlannerSnapshot> {
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );
  const shouldMaterializeLodging = lodging !== null && plan.days.length > 0;

  const placeRows = buildAiGeneratedPlaceRows({
    tripId,
    generationId,
    plan,
    candidateById,
    lodging: shouldMaterializeLodging ? lodging : null,
  });

  if (placeRows.length === 0) {
    await deletePreviousAiBatch(tripId, generationId);
    return getPlannerSnapshot(tripId);
  }

  let insertedItems: Array<{ id: number }>;

  try {
    const { data: places, error: placeError } = await getSupabaseClient()
      .from("places")
      .insert(placeRows)
      .select("id");

    if (placeError) throwSupabaseError(placeError);

    const placeIds = ((places ?? []) as Array<{ id: number }>).map(
      (place) => place.id,
    );
    const scheduleEntries = buildGeneratedScheduleEntries({
      plan,
      candidateById,
      lodging: shouldMaterializeLodging ? lodging : null,
      lodgingStartTime,
      lodgingPlaceId: shouldMaterializeLodging ? (placeIds[0] ?? null) : null,
      candidatePlaceIds: shouldMaterializeLodging
        ? placeIds.slice(1)
        : placeIds,
    });
    const itemRows = scheduleEntries.map((entry) => ({
      trip_id: tripId,
      place_id: entry.placeId,
      visit_date: entry.date,
      visit_time: entry.startTime,
      notes: entry.notes,
      created_by_source: "ai",
      ai_generation_id: generationId,
    }));

    const { data: items, error: itemError } = await getSupabaseClient()
      .from("itinerary_items")
      .insert(itemRows)
      .select("id");

    if (itemError) throwSupabaseError(itemError);
    insertedItems = (items ?? []) as Array<{ id: number }>;

    await deletePreviousAiBatch(tripId, generationId);
    await reconcileRoutesForTrip(tripId);
    await tagGeneratedRouteSegments(
      tripId,
      generationId,
      scheduleEntries.map((entry, index) => {
        const item = insertedItems[index];
        if (!item) {
          throw new Error("Inserted itinerary item was not returned.");
        }

        return {
          itemId: item.id,
          date: entry.date,
          startTime: entry.startTime,
          location: entry.location,
          order: entry.order,
        };
      }),
      preferences.preferred_travel_modes,
    );
  } catch (error) {
    await deleteAiBatchForGeneration(tripId, generationId).catch(() => undefined);
    throw error;
  }

  return getPlannerSnapshot(tripId);
}

async function deletePreviousAiBatch(
  tripId: number,
  generationId: number,
): Promise<void> {
  for (const table of AI_BATCH_TABLES) {
    await runDelete(
      getSupabaseClient()
        .from(table)
        .delete()
        .eq("trip_id", tripId)
        .eq("created_by_source", "ai")
        .is("ai_generation_id", null),
    );
    await runDelete(
      getSupabaseClient()
        .from(table)
        .delete()
        .eq("trip_id", tripId)
        .eq("created_by_source", "ai")
        .neq("ai_generation_id", generationId),
    );
  }
}

async function deleteAiBatchForGeneration(
  tripId: number,
  generationId: number,
): Promise<void> {
  for (const table of AI_BATCH_TABLES) {
    await runDelete(
      getSupabaseClient()
        .from(table)
        .delete()
        .eq("trip_id", tripId)
        .eq("created_by_source", "ai")
        .eq("ai_generation_id", generationId),
    );
  }
}

async function runDelete(
  result: PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  const { error } = await result;
  if (error) throwSupabaseError(error);
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
  visits: GeneratedVisitContext[],
  preferredModes: TravelMode[],
): Promise<void> {
  const routePairs = buildGeneratedRoutePairs(visits);
  if (routePairs.length === 0) return;

  const itemIds = visits.map((visit) => visit.itemId);
  const { data, error } = await getSupabaseClient()
    .from("route_segments")
    .select("id, from_item_id, to_item_id")
    .eq("trip_id", tripId)
    .in("from_item_id", itemIds)
    .in("to_item_id", itemIds);

  if (error) throwSupabaseError(error);

  const segmentByPair = new Map(
    ((data ?? []) as RouteSegmentRow[]).map((segment) => [
      routePairKey(segment.from_item_id, segment.to_item_id),
      segment,
    ]),
  );
  let walkingProbeCount = 0;

  for (const routePair of routePairs) {
    const segment = segmentByPair.get(
      routePairKey(routePair.from.itemId, routePair.to.itemId),
    );
    if (!segment) continue;

    const mode = await chooseAiRouteMode({
      preferredModes,
      from: routePair.from.location,
      to: routePair.to.location,
      canProbeWalking: walkingProbeCount < AI_ROUTE_MODE_WALKING_PROBE_LIMIT,
      getWalkingDurationSeconds: async () => {
        walkingProbeCount += 1;
        const geometry = await getRouteGeometry(tripId, segment.id);
        return geometry.status === "ok" ? geometry.duration_seconds ?? null : null;
      },
    });

    await updateGeneratedRouteSegment(tripId, generationId, segment.id, mode);
  }
}

async function updateGeneratedRouteSegment(
  tripId: number,
  generationId: number,
  segmentId: number,
  mode: TravelMode,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("route_segments")
    .update({
      created_by_source: "ai",
      ai_generation_id: generationId,
      mode,
      updated_at: new Date().toISOString(),
    })
    .eq("trip_id", tripId)
    .eq("id", segmentId);

  if (error) throwSupabaseError(error);
}

function buildGeneratedRoutePairs(
  visits: GeneratedVisitContext[],
): GeneratedRoutePair[] {
  const visitsByDate = new Map<string, GeneratedVisitContext[]>();

  for (const visit of visits) {
    if (!Number.isInteger(visit.itemId)) continue;
    const dayVisits = visitsByDate.get(visit.date) ?? [];
    dayVisits.push(visit);
    visitsByDate.set(visit.date, dayVisits);
  }

  const routePairs: GeneratedRoutePair[] = [];
  for (const dayVisits of visitsByDate.values()) {
    const sortedVisits = [...dayVisits].sort(compareGeneratedVisits);
    for (let index = 0; index < sortedVisits.length - 1; index += 1) {
      routePairs.push({
        from: sortedVisits[index],
        to: sortedVisits[index + 1],
      });
    }
  }

  return routePairs;
}

function compareGeneratedVisits(
  left: GeneratedVisitContext,
  right: GeneratedVisitContext,
): number {
  return (
    left.startTime.localeCompare(right.startTime) ||
    left.order - right.order ||
    left.itemId - right.itemId
  );
}

function routePairKey(fromItemId: number, toItemId: number): string {
  return `${fromItemId}->${toItemId}`;
}

function throwSupabaseError(error: { message: string }): never {
  throw new Error(`Supabase query failed: ${error.message}`);
}
