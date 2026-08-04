import { isValid24HourTime } from "@/lib/date-validation";
import {
  AI_DEFAULT_DAILY_START_TIME,
  AI_DEFAULT_PLANNING_PREFERENCES,
  AI_INTEREST_TAG_OPTIONS,
  AI_TRAVEL_MODE_OPTIONS,
  AI_VISITS_PER_DAY_MAX,
  AI_VISITS_PER_DAY_MIN,
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

  const selectedInterestTags = interestTags(body.interest_tags);
  const avoidInterestTags = interestTags(body.avoid_interest_tags);
  if (avoidInterestTags.some((tag) => selectedInterestTags.includes(tag))) {
    throw new TripValidationError(
      "An interest tag cannot also be avoided.",
    );
  }

  return {
    visits_per_day_min: visitsPerDayMin,
    visits_per_day_max: visitsPerDayMax,
    interest_tags: selectedInterestTags,
    avoid_interest_tags: avoidInterestTags,
    preferred_travel_modes: preferredTravelModes,
    must_see_candidate_ids: mustSeeCandidateIds(
      body.must_see_candidate_ids,
      allowedCandidateIds,
    ),
    daily_start_time: dailyStartTime(body.daily_start_time),
  };
}

export function parseAiPlanningGenerationInput(
  payload: unknown,
  allowedCandidateIds: ReadonlySet<number>,
  allowedTransitHubIds: ReadonlySet<number> = new Set(),
): {
  preferences: AiPlanningPreferenceInput;
  lodging_google_maps_url: string | null;
  arrival_hub_id: number | null;
  arrival_google_maps_url: string | null;
  arrival_time: string | null;
  departure_hub_id: number | null;
  departure_google_maps_url: string | null;
  departure_time: string | null;
} {
  const body = asRecord(payload);

  return {
    preferences: parseAiPlanningPreferenceInput(payload, allowedCandidateIds),
    lodging_google_maps_url: optionalGoogleMapsUrl(
      body.lodging_google_maps_url,
      "Lodging",
    ),
    arrival_hub_id: optionalTransitHubId(
      body.arrival_hub_id,
      "Arrival stop",
      allowedTransitHubIds,
    ),
    arrival_google_maps_url: optionalGoogleMapsUrl(
      body.arrival_google_maps_url,
      "Arrival stop",
    ),
    arrival_time: optionalEventTime(body.arrival_time, "Arrival time"),
    departure_hub_id: optionalTransitHubId(
      body.departure_hub_id,
      "Departure stop",
      allowedTransitHubIds,
    ),
    departure_google_maps_url: optionalGoogleMapsUrl(
      body.departure_google_maps_url,
      "Departure stop",
    ),
    departure_time: optionalEventTime(body.departure_time, "Departure time"),
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
    value < AI_VISITS_PER_DAY_MIN ||
    value > AI_VISITS_PER_DAY_MAX
  ) {
    throw new TripValidationError(
      `Visits per day must be between ${AI_VISITS_PER_DAY_MIN} and ${AI_VISITS_PER_DAY_MAX}.`,
    );
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

function optionalGoogleMapsUrl(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new TripValidationError(`${label} Google Maps URL must be a string.`);
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function optionalTransitHubId(
  value: unknown,
  label: string,
  allowedTransitHubIds: ReadonlySet<number>,
): number | null {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0 ||
    !allowedTransitHubIds.has(value)
  ) {
    throw new TripValidationError(
      `${label} must be one of the destination's transit hubs.`,
    );
  }

  return value;
}

function optionalEventTime(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new TripValidationError(`${label} must be HH:MM.`);
  }

  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!isValid24HourTime(trimmed)) {
    throw new TripValidationError(`${label} must be HH:MM.`);
  }

  return trimmed;
}

function dailyStartTime(value: unknown): string {
  if (value === undefined || value === null) return AI_DEFAULT_DAILY_START_TIME;
  if (typeof value !== "string") {
    throw new TripValidationError("Daily start time must be HH:MM.");
  }

  const trimmed = value.trim();
  if (trimmed === "") return AI_DEFAULT_DAILY_START_TIME;
  if (!isValid24HourTime(trimmed)) {
    throw new TripValidationError("Daily start time must be HH:MM.");
  }

  return trimmed;
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
