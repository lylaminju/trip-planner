import type { TravelMode } from "@/lib/types";
import { getSupabaseClient } from "./supabase";

export type RowId = {
  id: number;
};

export type RouteSegmentRow = {
  id: number;
  from_item_id: number;
  to_item_id: number;
};

const AI_BATCH_TABLES = ["route_segments", "itinerary_items", "places"] as const;

export async function insertAiGeneratedPlaces(
  rows: readonly Record<string, unknown>[],
): Promise<RowId[]> {
  const { data, error } = await getSupabaseClient()
    .from("places")
    .insert(rows)
    .select("id");

  if (error) throwSupabaseError(error);
  return (data ?? []) as RowId[];
}

export async function insertAiGeneratedItineraryItems(
  rows: readonly Record<string, unknown>[],
): Promise<RowId[]> {
  const { data, error } = await getSupabaseClient()
    .from("itinerary_items")
    .insert(rows)
    .select("id");

  if (error) throwSupabaseError(error);
  return (data ?? []) as RowId[];
}

export async function deletePreviousAiBatch(
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

export async function deleteAiBatchForGeneration(
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

export async function reconcileRoutesForTrip(tripId: number): Promise<void> {
  const { error } = await getSupabaseClient().rpc(
    "reconcile_route_segments_for_trip",
    { p_trip_id: tripId },
  );

  if (error) throwSupabaseError(error);
}

export async function listGeneratedRouteSegmentsForItems(
  tripId: number,
  itemIds: number[],
): Promise<RouteSegmentRow[]> {
  const { data, error } = await getSupabaseClient()
    .from("route_segments")
    .select("id, from_item_id, to_item_id")
    .eq("trip_id", tripId)
    .in("from_item_id", itemIds)
    .in("to_item_id", itemIds);

  if (error) throwSupabaseError(error);
  return (data ?? []) as RouteSegmentRow[];
}

export async function updateGeneratedItineraryItemTime(
  tripId: number,
  itemId: number,
  visitTime: string,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("itinerary_items")
    .update({ visit_time: visitTime, updated_at: new Date().toISOString() })
    .eq("trip_id", tripId)
    .eq("id", itemId);

  if (error) throwSupabaseError(error);
}

export async function updateGeneratedRouteSegment(
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

async function runDelete(
  result: PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  const { error } = await result;
  if (error) throwSupabaseError(error);
}

function throwSupabaseError(error: { message: string }): never {
  throw new Error(`Supabase query failed: ${error.message}`);
}
