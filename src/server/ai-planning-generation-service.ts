import { destinationCandidateKey } from "@/lib/ai-planning";
import {
  AI_PLANNING_MAX_TRIP_DAYS,
  aiCoverageMinTotalVisits,
  exceedsAiPlanningTripLength,
  hasAiPlanningDateRange,
  isAiCoverageTrip,
} from "@/lib/ai-planning-preferences";
import type {
  AiDestinationCandidate,
  AiPlanningPreferenceInput,
  PlannerSnapshot,
  Trip,
} from "@/lib/types";

import {
  firstDayEarliestStartFromArrival,
  lastDayLatestEndFromDeparture,
} from "@/lib/transit-buffers";

import {
  enrichLunchStops,
  unverifiedLunchStops,
  type EnrichedLunchStop,
  type LunchDayLog,
} from "./ai-lunch-enrichment";
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
import {
  requestAiItineraryPlan,
  type AiItineraryPlan,
} from "./openai-ai-planner";
import { requireTripRole } from "./trip-access";
import { getTripById } from "./trip-service";

// v3: no-repeat and must-see-exactly-once rules; low reasoning effort.
// v4: coverage mode plans sightseeing days plus free days on long trips.
// v5: avoided interest tags drop matching candidates from the planner's
//     catalog (must-see picks exempt), so the model never sees them.
// v6: opt-in lunch stops — one model-picked restaurant per day honoring
//     budget/dietary preferences, verified via Google Places after validation.
// v7: each lunch slot carries 2 ranked candidates; selection resolves them via
//     free IDs-only search, fetches Place Details Enterprise in rank order,
//     and gates on operational status, lunch-window hours, and budget tier.
const AI_PLANNER_PROMPT_VERSION = "ai-itinerary-v7";

const CATALOG_NOT_READY_MESSAGE =
  "This destination's attraction catalog hasn't been prepared yet. Reopen the AI planning wizard to prepare it.";

// The cap applies to AI generation only; the trip itself may be longer.
const TRIP_TOO_LONG_MESSAGE = `AI planning supports trips up to ${AI_PLANNING_MAX_TRIP_DAYS} days. For a longer stay, generate an itinerary for a shorter date range and extend it manually.`;

export async function generateAiItineraryForRequest(
  tripId: number,
  userId: string,
  payload: unknown,
  ipHash: string | null = null,
): Promise<{ generationId: number; plannerSnapshot: PlannerSnapshot }> {
  const startedAt = Date.now();
  await requireTripRole(tripId, userId, "owner");

  // Only the AI budget gates a run. Route lookups are asserted per call on a
  // geometry cache miss, and every route-dependent refinement here (walking-mode
  // probes, first-visit realignment) falls back when that assertion fails, so an
  // exhausted routes budget degrades the plan instead of blocking a generation
  // that still has AI budget left.
  await assertAiGenerationQuota(userId);

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
  // Avoided interests are enforced by construction: matching candidates are
  // removed from the catalog the model sees (and from the validation ID set),
  // except places the user explicitly locked in as must-sees.
  const plannableCandidates = withoutAvoidedCandidates(
    candidates,
    savedPreferences,
  );
  if (plannableCandidates.length === 0) {
    throw new TripValidationError(AVOIDED_EVERYTHING_MESSAGE);
  }
  // Coverage trips cannot fill every day from the catalog, so the plan carries
  // free days: validation swaps the every-day requirement for a total-visits
  // floor, keeping arrival/departure days required so batch application can
  // anchor their transit points to real first/last planned dates.
  const coverage = isAiCoverageTrip(
    tripDates.length,
    savedPreferences.visits_per_day_min,
    plannableCandidates.length,
  )
    ? { min_total_visits: aiCoverageMinTotalVisits(plannableCandidates.length) }
    : null;
  const coverageValidation = coverage
    ? {
        minTotalVisits: coverage.min_total_visits,
        requireFirstTripDate: arrivalPoint !== null,
        requireLastTripDate: departurePoint !== null,
      }
    : null;
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

  const isGuest = guestIdFromPrincipalId(userId) !== null;

  try {
    const config = openAiPlannerConfig();
    const primary = await requestAiItineraryPlan({
      apiKey: config.apiKey,
      model: config.model,
      // Guests get model-knowledge-only generations; live web verification is
      // reserved for invited accounts.
      enableWebSearch: !isGuest,
      context: promptContext({
        trip,
        lodging,
        arrivalPoint,
        departurePoint,
        candidates: plannableCandidates,
        preferences: savedPreferences,
        dailyStartTime: savedPreferences.daily_start_time,
        tripDates,
        coverage,
        validationErrors: [],
      }),
    });
    const primaryValidation = validateAiItineraryPlan(primary.plan, {
      candidateIds: candidateIdSet(plannableCandidates),
      tripDates,
      visitsPerDayMin: savedPreferences.visits_per_day_min,
      visitsPerDayMax: savedPreferences.visits_per_day_max,
      mustSeeCandidateIds: savedPreferences.must_see_candidate_ids,
      earliestVisitStartTime: lodging ? savedPreferences.daily_start_time : null,
      firstDayEarliestStartTime,
      lastDayLatestEndTime,
      coverage: coverageValidation,
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
          candidates: plannableCandidates,
          preferences: savedPreferences,
          dailyStartTime: savedPreferences.daily_start_time,
          tripDates,
          coverage,
          validationErrors: primaryValidation.errors,
        }),
      });
      const repairValidation = validateAiItineraryPlan(repair.plan, {
        candidateIds: candidateIdSet(plannableCandidates),
        tripDates,
        visitsPerDayMin: savedPreferences.visits_per_day_min,
        visitsPerDayMax: savedPreferences.visits_per_day_max,
        mustSeeCandidateIds: savedPreferences.must_see_candidate_ids,
        earliestVisitStartTime: lodging ? savedPreferences.daily_start_time : null,
        firstDayEarliestStartTime,
        lastDayLatestEndTime,
        coverage: coverageValidation,
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
          web_search_calls: isGuest ? null : primary.webSearchCalls,
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

    // Lunch selection is the run's only Places spend (free id resolution plus
    // short-circuited Place Details Enterprise fetches); guests skip it and
    // keep unverified model picks, mirroring the web-search split above. Every
    // failure inside degrades down the fallback ladder rather than failing an
    // already-validated generation.
    let lunchByDate: Map<string, EnrichedLunchStop> = new Map();
    let lunchVerificationLog: LunchDayLog[] | null = null;
    if (savedPreferences.include_lunch_stop) {
      if (isGuest) {
        lunchByDate = unverifiedLunchStops(finalPlan);
      } else {
        const enrichment = await enrichLunchStops({
          plan: finalPlan,
          destination: trip.destination,
          userId,
          diningBudget: savedPreferences.dining_budget,
        });
        lunchByDate = enrichment.lunchByDate;
        lunchVerificationLog = enrichment.log;
      }
    }

    const plannerSnapshot = await replaceAiGeneratedBatch(
      tripId,
      generation.id,
      finalPlan,
      plannableCandidates,
      savedPreferences,
      lodging,
      savedPreferences.daily_start_time,
      userId,
      arrivalPoint,
      departurePoint,
      lunchByDate,
    );
    await updateAiPlanGeneration(generation.id, {
      status: "completed",
      model: config.model,
      primary_validation_status: primaryValidation.status,
      primary_validation_errors: primaryValidation.errors,
      repair_attempted: repairAttempted,
      repair_validation_status: repairValidationStatus,
      repair_validation_errors: repairValidationErrors,
      generated_place_count: countGeneratedVisits(finalPlan) + lunchByDate.size,
      lunch_verification_log: lunchVerificationLog,
      // Only the primary call can search (repairs run without the tool); null
      // marks runs where the tool was never attached at all.
      web_search_calls: isGuest ? null : primary.webSearchCalls,
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

const AVOIDED_EVERYTHING_MESSAGE =
  "Your avoided interests rule out every attraction we know for this destination. Un-avoid an interest or lock in some must-sees, then try again.";

function withoutAvoidedCandidates(
  candidates: AiDestinationCandidate[],
  preferences: AiPlanningPreferenceInput,
): AiDestinationCandidate[] {
  const avoidedTags = new Set(preferences.avoid_interest_tags);
  if (avoidedTags.size === 0) return candidates;
  const mustSeeIds = new Set(preferences.must_see_candidate_ids);
  return candidates.filter(
    (candidate) =>
      mustSeeIds.has(candidate.id) ||
      !candidate.tags.some((tag) => avoidedTags.has(tag)),
  );
}

function tripDateRange(trip: Pick<Trip, "start_date" | "end_date">): string[] {
  if (!hasAiPlanningDateRange(trip)) {
    throw new TripValidationError("Trip dates are required for AI planning.");
  }
  if (exceedsAiPlanningTripLength(trip)) {
    throw new TripValidationError(TRIP_TOO_LONG_MESSAGE);
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
