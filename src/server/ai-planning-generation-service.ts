import { destinationCandidateKey } from "@/lib/ai-planning";
import type { PlannerSnapshot, Trip } from "@/lib/types";
import { isValidIsoDate } from "@/app/api/_utils";

import {
  firstDayEarliestStartFromArrival,
  lastDayLatestEndFromDeparture,
} from "@/lib/transit-buffers";

import { promptContext } from "./ai-planner-prompt-context";
import { validateAiItineraryPlan } from "./ai-plan-validation";
import { parseAiPlanningGenerationInput } from "./ai-planning-preferences";
import {
  assertAiGenerationQuota,
  candidateIdSet,
  DESTINATION_NOT_PLANNABLE_MESSAGE,
  generationFailureReason,
  openAiPlannerConfig,
} from "./ai-planning-shared";
import {
  resolveTransitPointForGeneration,
  transitPointOfKind,
} from "./ai-planning-transit-points";
import { TripValidationError } from "./errors";
import { guestIdFromPrincipalId } from "./principal";
import {
  createAiPlanGeneration,
  replaceAiGeneratedBatch,
  updateAiPlanGeneration,
} from "./supabase-ai-plan-application-service";
import {
  getPrimaryLodging,
  getTransitPoints,
  listDestinationCandidates,
  listDestinationTransitHubs,
  upsertPrimaryLodgingFromGoogleMapsUrl,
  upsertPlanningPreferences,
} from "./supabase-ai-planning-service";
import { assertGoogleRoutesQuota } from "./supabase-google-routes-usage-store";
import {
  requestAiItineraryPlan,
  type AiItineraryPlan,
} from "./openai-ai-planner";
import { requireTripRole } from "./trip-access";
import { getTripById } from "./trip-service";

// v2: web search verifies scheduled places' operation and opening days.
const AI_PLANNER_PROMPT_VERSION = "ai-itinerary-v3";

const CATALOG_NOT_READY_MESSAGE =
  "This destination's attraction catalog hasn't been prepared yet. Reopen the AI planning wizard to prepare it.";

export async function generateAiItineraryForRequest(
  tripId: number,
  userId: string,
  payload: unknown,
  ipHash: string | null = null,
): Promise<{ generationId: number; plannerSnapshot: PlannerSnapshot }> {
  const startedAt = Date.now();
  await requireTripRole(tripId, userId, "owner");

  await assertAiGenerationQuota(userId);
  await assertGoogleRoutesQuota(userId);

  const trip = await getTripById(tripId);
  const candidateKey = destinationCandidateKey(trip);
  if (!candidateKey) {
    throw new TripValidationError(DESTINATION_NOT_PLANNABLE_MESSAGE);
  }
  const tripDates = tripDateRange(trip);
  const [candidates, existingLodging, existingTransitPoints, transitHubs] =
    await Promise.all([
      listDestinationCandidates(candidateKey),
      getPrimaryLodging(tripId),
      getTransitPoints(tripId),
      listDestinationTransitHubs(candidateKey),
    ]);
  if (candidates.length === 0) {
    throw new TripValidationError(CATALOG_NOT_READY_MESSAGE);
  }
  const hubById = new Map(transitHubs.map((hub) => [hub.id, hub]));
  const generationInput = parseAiPlanningGenerationInput(
    payload,
    candidateIdSet(candidates),
    new Set(hubById.keys()),
  );
  const lodging = generationInput.lodging_google_maps_url
    ? await upsertPrimaryLodgingFromGoogleMapsUrl(
        tripId,
        generationInput.lodging_google_maps_url,
      )
    : existingLodging;
  const arrivalPoint = await resolveTransitPointForGeneration(
    tripId,
    "arrival",
    {
      hub: generationInput.arrival_hub_id
        ? (hubById.get(generationInput.arrival_hub_id) ?? null)
        : null,
      googleMapsUrl: generationInput.arrival_google_maps_url,
      eventTime: generationInput.arrival_time,
    },
    transitPointOfKind(existingTransitPoints, "arrival"),
  );
  const departurePoint = await resolveTransitPointForGeneration(
    tripId,
    "departure",
    {
      hub: generationInput.departure_hub_id
        ? (hubById.get(generationInput.departure_hub_id) ?? null)
        : null,
      googleMapsUrl: generationInput.departure_google_maps_url,
      eventTime: generationInput.departure_time,
    },
    transitPointOfKind(existingTransitPoints, "departure"),
  );
  // Hard realism floors the plan must respect: the first day cannot start until
  // the arrival hub's egress buffer has passed, and the last day must wrap up
  // before the departure hub's pre-departure buffer (airports need the most).
  const firstDayEarliestStartTime =
    firstDayEarliestStartFromArrival(arrivalPoint);
  const lastDayLatestEndTime = lastDayLatestEndFromDeparture(departurePoint);
  const savedPreferences = await upsertPlanningPreferences(
    tripId,
    generationInput.preferences,
  );
  const generation = await createAiPlanGeneration(
    tripId,
    userId,
    {
      prompt_version: AI_PLANNER_PROMPT_VERSION,
      preferences_snapshot: savedPreferences,
      candidate_count: candidates.length,
      must_see_count: savedPreferences.must_see_candidate_ids.length,
    },
    ipHash,
  );

  try {
    const config = openAiPlannerConfig();
    const primary = await requestAiItineraryPlan({
      apiKey: config.apiKey,
      model: config.model,
      // Guests get model-knowledge-only generations; live web verification is
      // reserved for invited accounts.
      enableWebSearch: guestIdFromPrincipalId(userId) === null,
      context: promptContext({
        trip,
        lodging,
        arrivalPoint,
        departurePoint,
        candidates,
        preferences: savedPreferences,
        dailyStartTime: generationInput.daily_start_time,
        tripDates,
        validationErrors: [],
      }),
    });
    const primaryValidation = validateAiItineraryPlan(primary.plan, {
      candidateIds: candidateIdSet(candidates),
      tripDates,
      visitsPerDayMin: savedPreferences.visits_per_day_min,
      visitsPerDayMax: savedPreferences.visits_per_day_max,
      mustSeeCandidateIds: savedPreferences.must_see_candidate_ids,
      earliestVisitStartTime: lodging ? generationInput.daily_start_time : null,
      firstDayEarliestStartTime,
      lastDayLatestEndTime,
    });

    let finalPlan = primary.plan;
    let finalUsage = primary.usage;
    let repairAttempted = false;
    let repairValidationStatus: "valid" | "invalid" | "not_attempted" =
      "not_attempted";
    let repairValidationErrors: string[] = [];

    if (primaryValidation.status === "invalid") {
      repairAttempted = true;
      const repair = await requestAiItineraryPlan({
        apiKey: config.apiKey,
        model: config.model,
        // Repairs intentionally skip web search: only the primary call spends
        // web-search budget, and the repair only reshuffles validated data.
        context: promptContext({
          trip,
          lodging,
          arrivalPoint,
          departurePoint,
          candidates,
          preferences: savedPreferences,
          dailyStartTime: generationInput.daily_start_time,
          tripDates,
          validationErrors: primaryValidation.errors,
        }),
      });
      const repairValidation = validateAiItineraryPlan(repair.plan, {
        candidateIds: candidateIdSet(candidates),
        tripDates,
        visitsPerDayMin: savedPreferences.visits_per_day_min,
        visitsPerDayMax: savedPreferences.visits_per_day_max,
        mustSeeCandidateIds: savedPreferences.must_see_candidate_ids,
        earliestVisitStartTime: lodging ? generationInput.daily_start_time : null,
        firstDayEarliestStartTime,
        lastDayLatestEndTime,
      });
      repairValidationStatus = repairValidation.status;
      repairValidationErrors = repairValidation.errors;

      if (repairValidation.status === "invalid") {
        await updateAiPlanGeneration(generation.id, {
          status: "failed",
          model: config.model,
          primary_validation_status: "invalid",
          primary_validation_errors: primaryValidation.errors,
          repair_attempted: true,
          repair_validation_status: "invalid",
          repair_validation_errors: repairValidation.errors,
          duration_ms: Date.now() - startedAt,
          token_input_count: sumTokens(
            primary.usage.inputTokens,
            repair.usage.inputTokens,
          ),
          token_output_count: sumTokens(
            primary.usage.outputTokens,
            repair.usage.outputTokens,
          ),
          failure_reason: "AI itinerary response could not be validated.",
        });
        throw new TripValidationError(
          "The AI planner couldn't create an itinerary with your current preferences. Please try again.",
        );
      }

      finalPlan = repair.plan;
      finalUsage = {
        inputTokens: sumTokens(primary.usage.inputTokens, repair.usage.inputTokens),
        outputTokens: sumTokens(
          primary.usage.outputTokens,
          repair.usage.outputTokens,
        ),
      };
    }

    const plannerSnapshot = await replaceAiGeneratedBatch(
      tripId,
      generation.id,
      finalPlan,
      candidates,
      savedPreferences,
      lodging,
      generationInput.daily_start_time,
      userId,
      arrivalPoint,
      departurePoint,
    );
    await updateAiPlanGeneration(generation.id, {
      status: "completed",
      model: config.model,
      primary_validation_status: primaryValidation.status,
      primary_validation_errors: primaryValidation.errors,
      repair_attempted: repairAttempted,
      repair_validation_status: repairValidationStatus,
      repair_validation_errors: repairValidationErrors,
      generated_place_count: countGeneratedVisits(finalPlan),
      generated_day_count: finalPlan.days.length,
      duration_ms: Date.now() - startedAt,
      token_input_count: finalUsage.inputTokens,
      token_output_count: finalUsage.outputTokens,
      failure_reason: null,
    });

    return { generationId: generation.id, plannerSnapshot };
  } catch (error) {
    if (error instanceof TripValidationError) {
      throw error;
    }

    await updateAiPlanGeneration(generation.id, {
      status: "failed",
      duration_ms: Date.now() - startedAt,
      failure_reason: generationFailureReason(error),
    });
    throw error;
  }
}

function tripDateRange(trip: Pick<Trip, "start_date" | "end_date">): string[] {
  if (
    !trip.start_date ||
    !trip.end_date ||
    !isValidIsoDate(trip.start_date) ||
    !isValidIsoDate(trip.end_date) ||
    trip.start_date > trip.end_date
  ) {
    throw new TripValidationError("Trip dates are required for AI planning.");
  }

  const dates: string[] = [];
  const current = new Date(`${trip.start_date}T00:00:00.000Z`);
  const end = new Date(`${trip.end_date}T00:00:00.000Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function countGeneratedVisits(plan: AiItineraryPlan): number {
  return plan.days.reduce((total, day) => total + day.visits.length, 0);
}

function sumTokens(
  left: number | null,
  right: number | null,
): number | null {
  return left === null && right === null ? null : (left ?? 0) + (right ?? 0);
}
