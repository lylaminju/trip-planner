import type {
  AiDestinationCandidate,
  AiPlanningPreferenceInput,
  PlannerSnapshot,
  TripLodging,
  TravelMode,
} from "@/lib/types";
import { AI_DEFAULT_DAILY_START_TIME } from "@/lib/ai-planning-preferences";
import {
  formatVisitTime,
  parseVisitTime,
  roundVisitMinutesUpToGrid,
} from "@/lib/visit-time";

import {
  buildAiGeneratedPlaceRows,
  buildGeneratedScheduleEntries,
  type Coordinates,
} from "./ai-plan-batch-rows";
import { chooseAiRouteMode } from "./ai-route-mode-selection";
import { getSupabaseClient } from "./supabase";
import { getPlannerSnapshot } from "./supabase-place-service";
import type { AiItineraryPlan } from "./openai-ai-planner";
import {
  getRouteDurationSeconds,
  getRouteGeometry,
} from "./route-geometry-service";

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
  isFirstOfDay: boolean;
};

type TaggedGeneratedRouteSegment = {
  segmentId: number;
  routePair: GeneratedRoutePair;
};

type RouteSegmentRow = {
  id: number;
  from_item_id: number;
  to_item_id: number;
};

type GeneratedRoutePlan = {
  mode: TravelMode;
  durationSeconds: number | null;
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

  const firstVisitRoutePlansByDate = await buildFirstVisitRoutePlansByDate({
    plan,
    candidateById,
    lodging: shouldMaterializeLodging ? lodging : null,
    preferredModes: preferences.preferred_travel_modes,
  });
  const firstVisitTravelDurationsByDate = routePlanDurationsByDate(
    firstVisitRoutePlansByDate,
  );

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
      firstVisitTravelDurationsByDate,
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
    const generatedVisits = scheduleEntries.map((entry, index) => {
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
    });
    const taggedRouteSegments = await tagGeneratedRouteSegments(
      tripId,
      generationId,
      generatedVisits,
      preferences.preferred_travel_modes,
      firstVisitRoutePlansByDate,
    );
    await alignFirstGeneratedVisitsWithRouteGeometry(
      tripId,
      generatedVisits,
      taggedRouteSegments,
      firstVisitRoutePlansByDate,
    );
  } catch (error) {
    await deleteAiBatchForGeneration(tripId, generationId).catch(() => undefined);
    throw error;
  }

  return getPlannerSnapshot(tripId);
}

async function buildFirstVisitRoutePlansByDate(input: {
  plan: AiItineraryPlan;
  candidateById: Map<number, AiDestinationCandidate>;
  lodging: TripLodging | null;
  preferredModes: TravelMode[];
}): Promise<Map<string, GeneratedRoutePlan>> {
  const plansByDate = new Map<string, GeneratedRoutePlan>();
  if (!input.lodging) return plansByDate;

  for (const day of input.plan.days) {
    const firstVisit = day.visits[0];
    if (!firstVisit) continue;

    const candidate = input.candidateById.get(firstVisit.candidate_id);
    if (!candidate) {
      throw new Error(`Candidate ${firstVisit.candidate_id} is not available.`);
    }

    const routePlan = await resolveTravelPlan(
      input.lodging,
      candidate,
      input.preferredModes,
    );
    plansByDate.set(day.date, routePlan);
  }

  return plansByDate;
}

function routePlanDurationsByDate(
  routePlansByDate: Map<string, GeneratedRoutePlan>,
): Map<string, number> {
  const durationsByDate = new Map<string, number>();
  for (const [date, routePlan] of routePlansByDate) {
    if (routePlan.durationSeconds !== null) {
      durationsByDate.set(date, routePlan.durationSeconds);
    }
  }
  return durationsByDate;
}

async function resolveTravelPlan(
  from: Coordinates,
  to: Coordinates,
  preferredModes: TravelMode[],
): Promise<GeneratedRoutePlan> {
  let walkingDurationSeconds: number | null | undefined;
  const mode = await chooseAiRouteMode({
    preferredModes,
    from,
    to,
    getWalkingDurationSeconds: async () => {
      walkingDurationSeconds = await safeRouteDurationSeconds(
        from,
        to,
        "walking",
      );
      return walkingDurationSeconds;
    },
  });

  if (mode === "walking" && walkingDurationSeconds !== undefined) {
    return { mode, durationSeconds: walkingDurationSeconds };
  }

  return {
    mode,
    durationSeconds: await safeRouteDurationSeconds(from, to, mode),
  };
}

async function safeRouteDurationSeconds(
  from: Coordinates,
  to: Coordinates,
  mode: TravelMode,
): Promise<number | null> {
  try {
    return await getRouteDurationSeconds({ from, to, mode });
  } catch {
    return null;
  }
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
  firstVisitRoutePlansByDate: Map<string, GeneratedRoutePlan> = new Map(),
): Promise<TaggedGeneratedRouteSegment[]> {
  const routePairs = buildGeneratedRoutePairs(visits);
  if (routePairs.length === 0) return [];

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
  const taggedSegments: TaggedGeneratedRouteSegment[] = [];

  for (const routePair of routePairs) {
    const segment = segmentByPair.get(
      routePairKey(routePair.from.itemId, routePair.to.itemId),
    );
    if (!segment) continue;

    const firstVisitRoutePlan = routePair.isFirstOfDay
      ? firstVisitRoutePlansByDate.get(routePair.from.date)
      : undefined;
    const mode =
      firstVisitRoutePlan?.mode ??
      (await chooseAiRouteMode({
        preferredModes,
        from: routePair.from.location,
        to: routePair.to.location,
        canProbeWalking: walkingProbeCount < AI_ROUTE_MODE_WALKING_PROBE_LIMIT,
        getWalkingDurationSeconds: async () => {
          walkingProbeCount += 1;
          const geometry = await getRouteGeometry(tripId, segment.id);
          return geometry.status === "ok"
            ? (geometry.duration_seconds ?? null)
            : null;
        },
      }));

    await updateGeneratedRouteSegment(tripId, generationId, segment.id, mode);
    taggedSegments.push({ segmentId: segment.id, routePair });
  }

  return taggedSegments;
}

async function alignFirstGeneratedVisitsWithRouteGeometry(
  tripId: number,
  visits: GeneratedVisitContext[],
  routeSegments: TaggedGeneratedRouteSegment[],
  firstVisitRoutePlansByDate: Map<string, GeneratedRoutePlan>,
): Promise<void> {
  if (firstVisitRoutePlansByDate.size === 0) return;

  const visitById = new Map(visits.map((visit) => [visit.itemId, visit]));
  for (const segment of routeSegments) {
    if (!segment.routePair.isFirstOfDay) {
      continue;
    }

    const firstVisitRoutePlan = firstVisitRoutePlansByDate.get(
      segment.routePair.from.date,
    );
    if (!firstVisitRoutePlan) continue;

    const fromVisit = visitById.get(segment.routePair.from.itemId);
    const toVisit = visitById.get(segment.routePair.to.itemId);
    if (!fromVisit || !toVisit) continue;

    const routeDurationSeconds =
      firstVisitRoutePlan.durationSeconds ??
      (await routeDurationSecondsForSegment(tripId, segment.segmentId));
    if (routeDurationSeconds === null) continue;

    const adjustedVisitTime = visitTimeAfterRouteDuration(
      fromVisit.startTime,
      toVisit.startTime,
      routeDurationSeconds,
    );
    if (adjustedVisitTime === toVisit.startTime) continue;

    toVisit.startTime = adjustedVisitTime;
    await updateGeneratedItineraryItemTime(
      tripId,
      toVisit.itemId,
      adjustedVisitTime,
    );
  }
}

async function routeDurationSecondsForSegment(
  tripId: number,
  segmentId: number,
): Promise<number | null> {
  try {
    const geometry = await getRouteGeometry(tripId, segmentId);
    return geometry?.status === "ok" ? (geometry.duration_seconds ?? null) : null;
  } catch {
    return null;
  }
}

function visitTimeAfterRouteDuration(
  fromVisitTime: string,
  toVisitTime: string,
  routeDurationSeconds: number,
): string {
  const fromMinutes = parseVisitTime(fromVisitTime);
  const toMinutes = parseVisitTime(toVisitTime);
  if (fromMinutes === null || toMinutes === null) return toVisitTime;

  const roundedToMinutes = roundVisitMinutesUpToGrid(toMinutes);
  const routeMinutes = Math.ceil(routeDurationSeconds / 60);
  if (!Number.isFinite(routeMinutes) || routeMinutes < 0) {
    return formatVisitTime(roundedToMinutes);
  }

  const earliestArrivalMinutes = roundVisitMinutesUpToGrid(
    fromMinutes + routeMinutes,
  );
  const adjustedMinutes = Math.max(roundedToMinutes, earliestArrivalMinutes);
  return toMinutes === adjustedMinutes
    ? toVisitTime
    : formatVisitTime(adjustedMinutes);
}

async function updateGeneratedItineraryItemTime(
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
        isFirstOfDay: index === 0,
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
