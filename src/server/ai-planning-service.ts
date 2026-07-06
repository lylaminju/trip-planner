import { isAiPlanningDestinationSupported } from "@/lib/ai-planning";
import type {
  AiDestinationCandidate,
  AiPlanningPreferenceInput,
  AiPlanningPreferences,
  AiPlanningSetup,
  PlannerSnapshot,
  Trip,
  TripLodging,
} from "@/lib/types";
import { isValidIsoDate } from "@/app/api/_utils";

import { validateAiItineraryPlan } from "./ai-plan-validation";
import { parseAiPlanningPreferenceInput } from "./ai-planning-preferences";
import { AiPlannerConfigError, TripValidationError } from "./errors";
import {
  createAiPlanGeneration,
  replaceAiGeneratedBatch,
  updateAiPlanGeneration,
} from "./supabase-ai-plan-application-service";
import {
  getPlanningPreferences,
  getPrimaryLodging,
  listDestinationCandidates,
  upsertPlanningPreferences,
} from "./supabase-ai-planning-service";
import {
  requestAiItineraryPlan,
  type AiItineraryPlan,
  type AiPlannerPromptContext,
} from "./openai-ai-planner";
import { requireTripRole } from "./trip-access";
import { getTripById } from "./trip-service";

const AI_PLANNER_PROMPT_VERSION = "ai-itinerary-v1";

export async function getAiPlanningSetupForRequest(
  tripId: number,
  userId: string,
): Promise<AiPlanningSetup> {
  await requireTripRole(tripId, userId, "owner");
  const trip = await getTripById(tripId);
  const isSupportedDestination = isAiPlanningDestinationSupported(
    trip.destination_slug,
  );

  if (!isSupportedDestination || !trip.destination_slug) {
    return {
      trip,
      isSupportedDestination: false,
      candidates: [],
      lodging: null,
      preferences: null,
    };
  }

  const [candidates, lodging, preferences] = await Promise.all([
    listDestinationCandidates(trip.destination_slug),
    getPrimaryLodging(tripId),
    getPlanningPreferences(tripId),
  ]);

  return {
    trip,
    isSupportedDestination,
    candidates,
    lodging,
    preferences,
  };
}

export async function saveAiPlanningPreferencesForRequest(
  tripId: number,
  userId: string,
  payload: unknown,
): Promise<AiPlanningPreferences> {
  await requireTripRole(tripId, userId, "owner");
  const trip = await getTripById(tripId);

  if (
    !trip.destination_slug ||
    !isAiPlanningDestinationSupported(trip.destination_slug)
  ) {
    throw new TripValidationError(
      "AI planning is not available for this destination.",
    );
  }

  const candidates = await listDestinationCandidates(trip.destination_slug);
  const input = parseAiPlanningPreferenceInput(
    payload,
    candidateIdSet(candidates),
  );

  return upsertPlanningPreferences(tripId, input);
}

export async function generateAiItineraryForRequest(
  tripId: number,
  userId: string,
  payload: unknown,
): Promise<{ generationId: number; plannerSnapshot: PlannerSnapshot }> {
  const startedAt = Date.now();
  await requireTripRole(tripId, userId, "owner");
  const trip = await getTripById(tripId);
  ensureSupportedDestination(trip);
  const tripDates = tripDateRange(trip);
  const [candidates, lodging] = await Promise.all([
    listDestinationCandidates(trip.destination_slug),
    getPrimaryLodging(tripId),
  ]);
  const preferences = parseAiPlanningPreferenceInput(
    payload,
    candidateIdSet(candidates),
  );
  const savedPreferences = await upsertPlanningPreferences(tripId, preferences);
  const generation = await createAiPlanGeneration(tripId, {
    prompt_version: AI_PLANNER_PROMPT_VERSION,
    preferences_snapshot: savedPreferences,
    candidate_count: candidates.length,
    must_see_count: savedPreferences.must_see_candidate_ids.length,
  });

  try {
    const config = openAiPlannerConfig();
    const primary = await requestAiItineraryPlan({
      apiKey: config.apiKey,
      model: config.model,
      context: promptContext({
        trip,
        lodging,
        candidates,
        preferences: savedPreferences,
        tripDates,
        validationErrors: [],
      }),
    });
    const primaryValidation = validateAiItineraryPlan(primary.plan, {
      candidateIds: candidateIdSet(candidates),
      tripDates,
      visitsPerDayMax: savedPreferences.visits_per_day_max,
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
        context: promptContext({
          trip,
          lodging,
          candidates,
          preferences: savedPreferences,
          tripDates,
          validationErrors: primaryValidation.errors,
        }),
      });
      const repairValidation = validateAiItineraryPlan(repair.plan, {
        candidateIds: candidateIdSet(candidates),
        tripDates,
        visitsPerDayMax: savedPreferences.visits_per_day_max,
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
          "AI itinerary response could not be validated.",
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
      failure_reason: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

function candidateIdSet(
  candidates: AiDestinationCandidate[],
): ReadonlySet<number> {
  return new Set(candidates.map((candidate) => candidate.id));
}

function ensureSupportedDestination(
  trip: Trip,
): asserts trip is Trip & { destination_slug: string } {
  if (
    !trip.destination_slug ||
    !isAiPlanningDestinationSupported(trip.destination_slug)
  ) {
    throw new TripValidationError(
      "AI planning is not available for this destination.",
    );
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

function promptContext(input: {
  trip: Trip;
  lodging: TripLodging | null;
  candidates: AiDestinationCandidate[];
  preferences: AiPlanningPreferenceInput;
  tripDates: string[];
  validationErrors: string[];
}): AiPlannerPromptContext {
  return {
    trip: {
      destination: input.trip.destination,
      start_date: input.trip.start_date,
      end_date: input.trip.end_date,
    },
    preferences: input.preferences,
    lodging: input.lodging
      ? {
          name: input.lodging.name,
          address: input.lodging.address,
          latitude: input.lodging.latitude,
          longitude: input.lodging.longitude,
        }
      : null,
    candidates: input.candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      category: candidate.category,
      tags: candidate.tags,
      area: candidate.area,
      region_distance_tier: candidate.region_distance_tier,
      typical_duration_minutes: candidate.typical_duration_minutes,
    })),
    tripDates: input.tripDates,
    validationErrors: input.validationErrors,
  };
}

function openAiPlannerConfig(): { apiKey: string; model: string } {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiPlannerConfigError("OpenAI API key is not configured.");
  }
  const model = process.env.OPENAI_AI_PLANNER_MODEL?.trim();
  if (!model) {
    throw new AiPlannerConfigError(
      "OpenAI AI planner model is not configured.",
    );
  }

  return {
    apiKey,
    model,
  };
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
