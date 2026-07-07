import {
  AI_DEFAULT_PLANNING_PREFERENCES,
  AI_INTEREST_TAG_OPTIONS,
  AI_TRAVEL_MODE_OPTIONS,
} from "@/lib/ai-planning-preferences";
import type { AiPlanningPreferenceInput, TravelMode } from "@/lib/types";

import { TripValidationError } from "./errors";

const INTEREST_TAG_VALUES = new Set<string>(
  AI_INTEREST_TAG_OPTIONS.map((option) => option.value),
);
const TRAVEL_MODE_VALUES = new Set<TravelMode>(
  AI_TRAVEL_MODE_OPTIONS.map((option) => option.value),
);

export function parseAiPlanningPreferenceInput(
  payload: unknown,
  allowedCandidateIds: ReadonlySet<number>,
): AiPlanningPreferenceInput {
  const body = asRecord(payload);
  const visitsPerDayMin = visitCount(
    body.visits_per_day_min,
    AI_DEFAULT_PLANNING_PREFERENCES.visits_per_day_min,
  );
  const visitsPerDayMax = visitCount(
    body.visits_per_day_max,
    AI_DEFAULT_PLANNING_PREFERENCES.visits_per_day_max,
  );

  if (visitsPerDayMin > visitsPerDayMax) {
    throw new TripValidationError(
      "Minimum visits per day cannot be greater than maximum visits per day.",
    );
  }

  const preferredTravelModes = travelModes(body.preferred_travel_modes);
  if (preferredTravelModes.length === 0) {
    throw new TripValidationError("At least one travel mode is required.");
  }

  return {
    visits_per_day_min: visitsPerDayMin,
    visits_per_day_max: visitsPerDayMax,
    interest_tags: interestTags(body.interest_tags),
    preferred_travel_modes: preferredTravelModes,
    must_see_candidate_ids: mustSeeCandidateIds(
      body.must_see_candidate_ids,
      allowedCandidateIds,
    ),
  };
}

export function parseAiPlanningGenerationInput(
  payload: unknown,
  allowedCandidateIds: ReadonlySet<number>,
): {
  preferences: AiPlanningPreferenceInput;
  lodging_google_maps_url: string | null;
} {
  const body = asRecord(payload);

  return {
    preferences: parseAiPlanningPreferenceInput(payload, allowedCandidateIds),
    lodging_google_maps_url: optionalLodgingGoogleMapsUrl(
      body.lodging_google_maps_url,
    ),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function visitCount(value: unknown, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 4
  ) {
    throw new TripValidationError("Visits per day must be between 1 and 4.");
  }

  return value;
}

function interestTags(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new TripValidationError("Interest tags must be an array.");
  }

  return unique(
    value.map((tag) => {
      if (typeof tag !== "string" || !INTEREST_TAG_VALUES.has(tag)) {
        throw new TripValidationError("Invalid interest tag.");
      }

      return tag;
    }),
  );
}

function travelModes(value: unknown): TravelMode[] {
  if (value === undefined || value === null) {
    return [...AI_DEFAULT_PLANNING_PREFERENCES.preferred_travel_modes];
  }
  if (!Array.isArray(value)) {
    throw new TripValidationError("Preferred travel modes must be an array.");
  }

  return unique(
    value.map((mode) => {
      if (typeof mode !== "string" || !isTravelMode(mode)) {
        throw new TripValidationError("Invalid travel mode.");
      }

      return mode;
    }),
  );
}

function optionalLodgingGoogleMapsUrl(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new TripValidationError("Lodging Google Maps URL must be a string.");
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function mustSeeCandidateIds(
  value: unknown,
  allowedCandidateIds: ReadonlySet<number>,
): number[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new TripValidationError("Must-see selections must be an array.");
  }

  return unique(
    value.map((id) => {
      if (!Number.isInteger(id) || id <= 0) {
        throw new TripValidationError("Must-see selections are invalid.");
      }
      if (!allowedCandidateIds.has(id)) {
        throw new TripValidationError(
          "Must-see selections must come from the curated candidate list.",
        );
      }

      return id;
    }),
  );
}

function isTravelMode(value: string): value is TravelMode {
  return TRAVEL_MODE_VALUES.has(value as TravelMode);
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
