import { destinationCandidateKey } from "@/lib/ai-planning";
import {
  countryNameFromCode,
  findDestinationFocus,
  findDestinationOption,
} from "@/lib/destination-options";
import type {
  AiDestinationCandidate,
  AiDestinationTransitHub,
  AiPlanningPreferences,
  AiPlanningSetup,
  PlannerSnapshot,
  Trip,
} from "@/lib/types";
import { isValidIsoDate } from "@/app/api/_utils";

import {
  firstDayEarliestStartFromArrival,
  lastDayLatestEndFromDeparture,
} from "@/lib/transit-buffers";

import { promptContext } from "./ai-planner-prompt-context";
import { validateAiItineraryPlan } from "./ai-plan-validation";
import {
  parseAiPlanningGenerationInput,
  parseAiPlanningPreferenceInput,
} from "./ai-planning-preferences";
import {
  AiGenerationRateLimitError,
  AiPlannerConfigError,
  AiUpstreamRateLimitError,
  TripValidationError,
} from "./errors";
import {
  countUserGenerationsToday,
  createAiPlanGeneration,
  replaceAiGeneratedBatch,
  updateAiPlanGeneration,
} from "./supabase-ai-plan-application-service";
import { recordGuestEvent } from "./guest-events";
import {
  countAllGuestCallsToday,
  countGuestCallsToday,
  GUEST_AI_GENERATION_DAILY_LIMIT,
  GUEST_AI_GENERATION_GLOBAL_DAILY_CAP,
  GUEST_USAGE_KIND,
} from "./guest-usage-store";
import { guestIdFromPrincipalId } from "./principal";
import { assertGoogleRoutesQuota } from "./supabase-google-routes-usage-store";
import {
  getPlanningPreferences,
  getPrimaryLodging,
  getTransitPoints,
  insertDestinationCandidates,
  insertDestinationTransitHubs,
  listDestinationCandidates,
  listDestinationTransitHubs,
  upsertPrimaryLodgingFromGoogleMapsUrl,
  upsertPlanningPreferences,
} from "./supabase-ai-planning-service";
import {
  requestAiDestinationCatalog,
  requestAiDestinationTransitHubs,
  sanitizeAiDestinationCandidates,
  sanitizeAiDestinationTransitHubs,
  type AiCatalogDestination,
} from "./openai-destination-catalog";
import { resolveCandidateImagesWithGoogle } from "./google-candidate-images";
import {
  resolveTransitPointForGeneration,
  transitPointOfKind,
} from "./ai-planning-transit-points";
import {
  requestAiItineraryPlan,
  type AiItineraryPlan,
} from "./openai-ai-planner";
import { requireTripRole } from "./trip-access";
import { getTripById } from "./trip-service";

// v2: web search verifies scheduled places' operation and opening days.
const AI_PLANNER_PROMPT_VERSION = "ai-itinerary-v2";
// v3: model knowledge only — closure verification moved to itinerary
// generation, where the trip dates are known.
const AI_CATALOG_PROMPT_VERSION = "ai-destination-catalog-v3";
const AI_HUBS_PROMPT_VERSION = "ai-destination-transit-hubs-v1";
const AI_GENERATION_DAILY_LIMIT = 30;

// Guests are bounded per cookie and by the demo-wide cap that bounds
// worst-case OpenAI spend; invited users keep the per-account daily limit.
async function assertAiGenerationQuota(principalId: string): Promise<void> {
  const guestId = guestIdFromPrincipalId(principalId);

  if (guestId === null) {
    const todayCount = await countUserGenerationsToday(principalId);
    if (todayCount >= AI_GENERATION_DAILY_LIMIT) {
      throw new AiGenerationRateLimitError(
        "Daily AI generation limit reached. Please try again tomorrow.",
      );
    }
    return;
  }

  const guestCount = await countGuestCallsToday(
    guestId,
    GUEST_USAGE_KIND.AI_GENERATION,
  );
  if (guestCount >= GUEST_AI_GENERATION_DAILY_LIMIT) {
    void recordGuestEvent(guestId, "limit_hit", {
      kind: GUEST_USAGE_KIND.AI_GENERATION,
      scope: "guest",
    });
    throw new AiGenerationRateLimitError(
      "Daily AI generation limit reached for this guest session. Sign in for a higher limit.",
    );
  }

  const globalCount = await countAllGuestCallsToday(
    GUEST_USAGE_KIND.AI_GENERATION,
  );
  if (globalCount >= GUEST_AI_GENERATION_GLOBAL_DAILY_CAP) {
    void recordGuestEvent(guestId, "limit_hit", {
      kind: GUEST_USAGE_KIND.AI_GENERATION,
      scope: "global",
    });
    throw new AiGenerationRateLimitError(
      "The guest demo's AI budget is used up for today. Sign in for full access.",
    );
  }
}

const DESTINATION_NOT_PLANNABLE_MESSAGE =
  "AI planning needs a trip destination first.";
const CATALOG_NOT_READY_MESSAGE =
  "This destination's attraction catalog hasn't been prepared yet. Reopen the AI planning wizard to prepare it.";

export async function getAiPlanningSetupForRequest(
  tripId: number,
  userId: string,
): Promise<AiPlanningSetup> {
  await requireTripRole(tripId, userId, "owner");
  const trip = await getTripById(tripId);
  const candidateKey = destinationCandidateKey(trip);

  if (!candidateKey) {
    return {
      trip,
      candidatesReady: false,
      candidates: [],
      lodging: null,
      arrivalPoint: null,
      departurePoint: null,
      transitHubs: [],
      preferences: null,
    };
  }

  const [candidates, lodging, transitPoints, transitHubs, preferences] =
    await Promise.all([
      listDestinationCandidates(candidateKey),
      getPrimaryLodging(tripId),
      getTransitPoints(tripId),
      listDestinationTransitHubs(candidateKey),
      getPlanningPreferences(tripId),
    ]);

  return {
    trip,
    candidatesReady: candidates.length > 0,
    candidates,
    lodging,
    arrivalPoint: transitPointOfKind(transitPoints, "arrival"),
    departurePoint: transitPointOfKind(transitPoints, "departure"),
    transitHubs,
    preferences,
  };
}

// Ensures the trip's destination has an attraction catalog, generating and
// persisting one with OpenAI when the destination has no curated rows yet.
// Returns the refreshed planning setup so the wizard can continue in one step.
export async function prepareDestinationCatalogForRequest(
  tripId: number,
  userId: string,
): Promise<AiPlanningSetup> {
  await requireTripRole(tripId, userId, "owner");
  const trip = await getTripById(tripId);
  const candidateKey = destinationCandidateKey(trip);
  if (!candidateKey) {
    throw new TripValidationError(DESTINATION_NOT_PLANNABLE_MESSAGE);
  }

  const existing = await listDestinationCandidates(candidateKey);
  if (existing.length === 0) {
    await generateDestinationCandidates(trip, candidateKey, tripId, userId);
  }

  return getAiPlanningSetupForRequest(tripId, userId);
}

// Companion to the catalog preparation above, split out because hubs come from
// a much smaller model call (no web search): the wizard fires both in parallel
// and the Start & end step unlocks as soon as this one lands.
export async function prepareDestinationTransitHubsForRequest(
  tripId: number,
  userId: string,
): Promise<AiDestinationTransitHub[]> {
  await requireTripRole(tripId, userId, "owner");
  const trip = await getTripById(tripId);
  const candidateKey = destinationCandidateKey(trip);
  if (!candidateKey) {
    throw new TripValidationError(DESTINATION_NOT_PLANNABLE_MESSAGE);
  }

  const existing = await listDestinationTransitHubs(candidateKey);
  if (existing.length > 0) {
    return existing;
  }

  return generateDestinationTransitHubs(trip, candidateKey, tripId, userId);
}

// Lighter than the full planning setup: the Add Place search step only needs
// the destination's candidate catalog, not lodging/transit/preferences.
export async function listDestinationCandidatesForRequest(
  tripId: number,
  userId: string,
): Promise<AiDestinationCandidate[]> {
  await requireTripRole(tripId, userId, "owner");
  const trip = await getTripById(tripId);
  const candidateKey = destinationCandidateKey(trip);
  if (!candidateKey) {
    return [];
  }
  return listDestinationCandidates(candidateKey);
}

export async function saveAiPlanningPreferencesForRequest(
  tripId: number,
  userId: string,
  payload: unknown,
): Promise<AiPlanningPreferences> {
  await requireTripRole(tripId, userId, "owner");
  const trip = await getTripById(tripId);
  const candidateKey = destinationCandidateKey(trip);

  if (!candidateKey) {
    throw new TripValidationError(DESTINATION_NOT_PLANNABLE_MESSAGE);
  }

  const candidates = await listDestinationCandidates(candidateKey);
  const input = parseAiPlanningPreferenceInput(
    payload,
    candidateIdSet(candidates),
  );

  return upsertPlanningPreferences(tripId, input);
}

// Generates a destination's attraction catalog with OpenAI (web search
// enabled) and persists it for reuse by every trip sharing the destination key.
async function generateDestinationCandidates(
  trip: Trip,
  candidateKey: string,
  tripId: number,
  userId: string,
): Promise<AiDestinationCandidate[]> {
  return runLoggedCatalogGeneration(
    tripId,
    userId,
    AI_CATALOG_PROMPT_VERSION,
    async (config) => {
      const destination = catalogDestinationContext(trip);
      const { catalog, usage } = await requestAiDestinationCatalog({
        apiKey: config.apiKey,
        model: config.model,
        destination,
      });
      const inserted = await insertDestinationCandidates(
        candidateKey,
        sanitizeAiDestinationCandidates(catalog, destination),
      );
      // Best-effort thumbnails: a missing key, exhausted photo budget, or
      // upstream failure must never fail the catalog itself.
      await resolveCandidateImagesWithGoogle({
        candidates: inserted,
        destination,
        userId,
      }).catch(() => undefined);
      return { result: inserted, insertedCount: inserted.length, usage };
    },
  );
}

// Generates the destination's arrival transit hubs with a small, fast model
// call (no web search) so the wizard's Start & end step is ready quickly.
async function generateDestinationTransitHubs(
  trip: Trip,
  candidateKey: string,
  tripId: number,
  userId: string,
): Promise<AiDestinationTransitHub[]> {
  return runLoggedCatalogGeneration(
    tripId,
    userId,
    AI_HUBS_PROMPT_VERSION,
    async (config) => {
      const destination = catalogDestinationContext(trip);
      const { hubList, usage } = await requestAiDestinationTransitHubs({
        apiKey: config.apiKey,
        model: config.model,
        destination,
      });
      const inserted = await insertDestinationTransitHubs(
        candidateKey,
        sanitizeAiDestinationTransitHubs(hubList, destination),
      );
      return { result: inserted, insertedCount: inserted.length, usage };
    },
  );
}

// Shared wrapper for one-time catalog generations: enforces the shared daily
// limit and logs the call in ai_plan_generations (distinct prompt version per
// call type) so cost and failures stay visible alongside itinerary runs.
async function runLoggedCatalogGeneration<T>(
  tripId: number,
  userId: string,
  promptVersion: string,
  produce: (config: { apiKey: string; model: string }) => Promise<{
    result: T;
    insertedCount: number;
    usage: { inputTokens: number | null; outputTokens: number | null };
  }>,
): Promise<T> {
  // Guests only ever see curated destinations whose catalogs are already
  // cached, so a missing catalog for a guest is out of contract; never spend
  // a catalog generation on one.
  if (guestIdFromPrincipalId(userId) !== null) {
    throw new TripValidationError(
      "Guest trips are limited to destinations with ready-made attraction catalogs.",
    );
  }

  const startedAt = Date.now();
  await assertAiGenerationQuota(userId);

  const config = openAiPlannerConfig();
  const generation = await createAiPlanGeneration(tripId, userId, {
    prompt_version: promptVersion,
    preferences_snapshot: {},
    candidate_count: 0,
    must_see_count: 0,
  });

  try {
    const { result, insertedCount, usage } = await produce(config);

    await updateAiPlanGeneration(generation.id, {
      status: "completed",
      model: config.model,
      generated_place_count: insertedCount,
      duration_ms: Date.now() - startedAt,
      token_input_count: usage.inputTokens,
      token_output_count: usage.outputTokens,
      failure_reason: null,
    });
    return result;
  } catch (error) {
    await updateAiPlanGeneration(generation.id, {
      status: "failed",
      model: config.model,
      duration_ms: Date.now() - startedAt,
      failure_reason: generationFailureReason(error),
    });
    throw error;
  }
}

// Upstream rate-limit errors carry a deliberately generic user-facing message;
// keep OpenAI's diagnostics (which limit, tokens requested, retry hint) in the
// logged failure reason so limit issues stay debuggable.
function generationFailureReason(error: unknown): string {
  if (error instanceof AiUpstreamRateLimitError && error.upstreamDetail) {
    return `${error.message} (${error.upstreamDetail})`;
  }
  return error instanceof Error ? error.message : "Unknown error";
}

// Destination context for catalog generation: custom destinations carry their
// own Google coordinates and country codes; curated presets fall back to the
// preset's coordinates and country.
function catalogDestinationContext(trip: Trip): AiCatalogDestination {
  const preset = trip.destination_slug
    ? findDestinationFocus(trip.destination_slug)
    : null;
  const countryCodes =
    trip.destination_country_codes ??
    (trip.destination_slug
      ? [findDestinationOption(trip.destination_slug)?.countryCode].filter(
          (code): code is string => Boolean(code),
        )
      : []);

  return {
    name: trip.destination,
    latitude: trip.destination_latitude ?? preset?.latitude ?? null,
    longitude: trip.destination_longitude ?? preset?.longitude ?? null,
    countryNames: countryCodes
      .map((code) => countryNameFromCode(code))
      .filter((name): name is string => Boolean(name)),
  };
}

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

function candidateIdSet(
  candidates: AiDestinationCandidate[],
): ReadonlySet<number> {
  return new Set(candidates.map((candidate) => candidate.id));
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
