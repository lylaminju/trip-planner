import { destinationCandidateKey } from "@/lib/ai-planning";
import {
  countryNameFromCode,
  findDestinationFocus,
  findDestinationOption,
} from "@/lib/destination-options";
import type {
  AiDestinationCandidate,
  AiDestinationTransitHub,
  AiPlanningSetup,
  Trip,
} from "@/lib/types";

import { loadAiPlanningSetupForTrip } from "./ai-planning-setup";
import {
  assertAiGenerationQuota,
  DESTINATION_NOT_PLANNABLE_MESSAGE,
  generationFailureReason,
  openAiPlannerConfig,
} from "./ai-planning-shared";
import { TripValidationError } from "./errors";
import { resolveCandidateImagesWithGoogle } from "./google-candidate-images";
import { guestIdFromPrincipalId } from "./principal";
import {
  createAiPlanGeneration,
  updateAiPlanGeneration,
} from "./supabase-ai-plan-application-service";
import {
  insertDestinationCandidates,
  insertDestinationTransitHubs,
  listDestinationCandidates,
  listDestinationTransitHubs,
} from "./supabase-ai-planning-service";
import {
  requestAiDestinationCatalog,
  requestAiDestinationTransitHubs,
  sanitizeAiDestinationCandidates,
  sanitizeAiDestinationTransitHubs,
  type AiCatalogDestination,
} from "./openai-destination-catalog";
import { requireTripRole } from "./trip-access";
import { getTripById } from "./trip-service";

// v3: model knowledge only — closure verification moved to itinerary
// generation, where the trip dates are known.
const AI_CATALOG_PROMPT_VERSION = "ai-destination-catalog-v3";
const AI_HUBS_PROMPT_VERSION = "ai-destination-transit-hubs-v1";

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

  return loadAiPlanningSetupForTrip(trip);
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
