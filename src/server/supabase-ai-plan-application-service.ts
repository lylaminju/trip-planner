import type {
  AiDestinationCandidate,
  AiPlanningPreferenceInput,
  PlannerSnapshot,
  TripLodging,
  TripTransitPoint,
  TravelMode,
} from "@/lib/types";
import { AI_DEFAULT_DAILY_START_TIME } from "@/lib/ai-planning-preferences";

import {
  buildAiGeneratedPlaceRows,
  buildGeneratedScheduleEntries,
  splitGeneratedPlaceIds,
  type Coordinates,
} from "./ai-plan-batch-rows";
import {
  buildGeneratedRoutePairs,
  routePairKey,
  visitTimeAfterRouteDuration,
  type GeneratedVisitContext,
  type TaggedGeneratedRouteSegment,
} from "./ai-generated-route-timing";
import { chooseAiRouteMode } from "./ai-route-mode-selection";
import { getPlannerSnapshot } from "./supabase-place-service";
import type { AiItineraryPlan } from "./openai-ai-planner";
import {
  getRouteDurationSeconds,
  getRouteGeometry,
} from "./route-geometry-service";
import {
  deleteAiBatchForGeneration,
  deletePreviousAiBatch,
  insertAiGeneratedItineraryItems,
  insertAiGeneratedPlaces,
  listGeneratedRouteSegmentsForItems,
  reconcileRoutesForTrip,
  updateGeneratedItineraryItemTime,
  updateGeneratedRouteSegment,
} from "./supabase-ai-plan-batch-store";

export {
  countUserGenerationsToday,
  createAiPlanGeneration,
  updateAiPlanGeneration,
} from "./supabase-ai-plan-generation-store";

type GeneratedRoutePlan = {
  mode: TravelMode;
  durationSeconds: number | null;
};

const AI_ROUTE_MODE_WALKING_PROBE_LIMIT = 10;

export async function replaceAiGeneratedBatch(
  tripId: number,
  generationId: number,
  plan: AiItineraryPlan,
  candidates: AiDestinationCandidate[],
  preferences: AiPlanningPreferenceInput,
  lodging: TripLodging | null = null,
  lodgingStartTime = AI_DEFAULT_DAILY_START_TIME,
  userId?: string,
  arrivalPoint: TripTransitPoint | null = null,
  departurePoint: TripTransitPoint | null = null,
): Promise<PlannerSnapshot> {
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );
  const hasDays = plan.days.length > 0;
  const materializedLodging = hasDays ? lodging : null;
  const materializedArrival = hasDays ? arrivalPoint : null;
  const materializedDeparture = hasDays ? departurePoint : null;

  const placeRows = buildAiGeneratedPlaceRows({
    tripId,
    generationId,
    plan,
    candidateById,
    lodging: materializedLodging,
    arrivalPoint: materializedArrival,
    departurePoint: materializedDeparture,
  });

  if (placeRows.length === 0) {
    await deletePreviousAiBatch(tripId, generationId);
    return getPlannerSnapshot(tripId);
  }

  const firstVisitRoutePlansByDate = await buildFirstVisitRoutePlansByDate({
    plan,
    candidateById,
    lodging: materializedLodging,
    arrivalPoint: materializedArrival,
    preferredModes: preferences.preferred_travel_modes,
    userId,
  });
  const firstVisitTravelDurationsByDate = routePlanDurationsByDate(
    firstVisitRoutePlansByDate,
  );

  let insertedItems: Array<{ id: number }>;

  try {
    const places = await insertAiGeneratedPlaces(placeRows);
    const placeIds = places.map((place) => place.id);
    const anchorPlaceIds = splitGeneratedPlaceIds(placeIds, {
      hasArrival: materializedArrival !== null,
      hasLodging: materializedLodging !== null,
      hasDeparture: materializedDeparture !== null,
    });
    const scheduleEntries = buildGeneratedScheduleEntries({
      plan,
      candidateById,
      lodging: materializedLodging,
      lodgingStartTime,
      lodgingPlaceId: anchorPlaceIds.lodgingPlaceId,
      arrivalPoint: materializedArrival,
      arrivalPlaceId: anchorPlaceIds.arrivalPlaceId,
      departurePoint: materializedDeparture,
      departurePlaceId: anchorPlaceIds.departurePlaceId,
      candidatePlaceIds: anchorPlaceIds.candidatePlaceIds,
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

    insertedItems = await insertAiGeneratedItineraryItems(itemRows);

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
      userId,
    );
    await alignFirstGeneratedVisitsWithRouteGeometry(
      tripId,
      generatedVisits,
      taggedRouteSegments,
      firstVisitRoutePlansByDate,
      userId,
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
  arrivalPoint?: TripTransitPoint | null;
  preferredModes: TravelMode[];
  userId?: string;
}): Promise<Map<string, GeneratedRoutePlan>> {
  const plansByDate = new Map<string, GeneratedRoutePlan>();
  const arrivalPoint = input.arrivalPoint ?? null;
  if (!input.lodging && !arrivalPoint) return plansByDate;

  const firstDate = input.plan.days.reduce<string | null>(
    (min, day) => (min === null || day.date < min ? day.date : min),
    null,
  );

  const measuredLegs: Array<{
    date: string;
    origin: Coordinates;
    destination: Coordinates;
  }> = [];
  for (const day of input.plan.days) {
    const dayStartsAtArrival = day.date === firstDate && arrivalPoint !== null;
    const origin = dayStartsAtArrival ? arrivalPoint : input.lodging;
    if (!origin) continue;

    // The measured leg mirrors the first scheduled hop of the day. On the
    // arrival day with lodging the traveler goes hub -> lodging to drop bags,
    // so that is the measured leg; otherwise it is origin -> first attraction.
    let destination: Coordinates;
    if (dayStartsAtArrival && input.lodging) {
      destination = input.lodging;
    } else {
      const firstVisit = day.visits[0];
      if (!firstVisit) continue;
      const candidate = input.candidateById.get(firstVisit.candidate_id);
      if (!candidate) {
        throw new Error(
          `Candidate ${firstVisit.candidate_id} is not available.`,
        );
      }
      destination = candidate;
    }

    measuredLegs.push({ date: day.date, origin, destination });
  }

  // Each day's leg is independent, so resolve them concurrently instead of
  // serializing one Google Routes round-trip per trip day.
  const resolvedLegs = await Promise.all(
    measuredLegs.map(async (leg) => ({
      date: leg.date,
      routePlan: await resolveTravelPlan(
        leg.origin,
        leg.destination,
        input.preferredModes,
        input.userId,
      ),
    })),
  );
  for (const { date, routePlan } of resolvedLegs) {
    plansByDate.set(date, routePlan);
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
  userId?: string,
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
        userId,
      );
      return walkingDurationSeconds;
    },
  });

  if (mode === "walking" && walkingDurationSeconds !== undefined) {
    return { mode, durationSeconds: walkingDurationSeconds };
  }

  return {
    mode,
    durationSeconds: await safeRouteDurationSeconds(from, to, mode, userId),
  };
}

async function safeRouteDurationSeconds(
  from: Coordinates,
  to: Coordinates,
  mode: TravelMode,
  userId?: string,
): Promise<number | null> {
  try {
    return await getRouteDurationSeconds({ from, to, mode, userId });
  } catch {
    return null;
  }
}

async function tagGeneratedRouteSegments(
  tripId: number,
  generationId: number,
  visits: GeneratedVisitContext[],
  preferredModes: TravelMode[],
  firstVisitRoutePlansByDate: Map<string, GeneratedRoutePlan> = new Map(),
  userId?: string,
): Promise<TaggedGeneratedRouteSegment[]> {
  const routePairs = buildGeneratedRoutePairs(visits);
  if (routePairs.length === 0) return [];

  const itemIds = visits.map((visit) => visit.itemId);
  const routeSegments = await listGeneratedRouteSegmentsForItems(tripId, itemIds);
  const segmentByPair = new Map(
    routeSegments.map((segment) => [
      routePairKey(segment.from_item_id, segment.to_item_id),
      segment,
    ]),
  );
  let walkingProbeCount = 0;
  const taggedSegments: TaggedGeneratedRouteSegment[] = [];
  const modeBySegmentId = new Map<number, TravelMode>();

  // Mode selection stays sequential: probes share the walking-probe budget.
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
          const geometry = await getRouteGeometry(tripId, segment.id, userId);
          return geometry.status === "ok"
            ? (geometry.duration_seconds ?? null)
            : null;
        },
      }));

    modeBySegmentId.set(segment.id, mode);
    taggedSegments.push({ segmentId: segment.id, routePair });
  }

  // The per-segment writes are independent of each other; flush them
  // concurrently instead of one round-trip per segment.
  await Promise.all(
    Array.from(modeBySegmentId, ([segmentId, mode]) =>
      updateGeneratedRouteSegment(tripId, generationId, segmentId, mode),
    ),
  );

  return taggedSegments;
}

async function alignFirstGeneratedVisitsWithRouteGeometry(
  tripId: number,
  visits: GeneratedVisitContext[],
  routeSegments: TaggedGeneratedRouteSegment[],
  firstVisitRoutePlansByDate: Map<string, GeneratedRoutePlan>,
  userId?: string,
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
      (await routeDurationSecondsForSegment(tripId, segment.segmentId, userId));
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
  userId?: string,
): Promise<number | null> {
  try {
    const geometry = await getRouteGeometry(tripId, segmentId, userId);
    return geometry?.status === "ok" ? (geometry.duration_seconds ?? null) : null;
  } catch {
    return null;
  }
}
