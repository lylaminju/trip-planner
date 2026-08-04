import { isValidIsoDate } from "./date-validation";
import type {
  AiPlanningPreferenceInput,
  AiPlanningSetup,
  TravelMode,
  Trip,
} from "./types";

export const AI_INTEREST_TAG_OPTIONS = [
  { value: "landmarks", label: "Landmarks", emoji: "📍" },
  { value: "museums", label: "Museums & galleries", emoji: "🏛️" },
  { value: "nature", label: "Nature", emoji: "🌿" },
  { value: "local-vibe", label: "Local vibe", emoji: "🏘️" },
  { value: "food", label: "Food & markets", emoji: "🍽️" },
  { value: "cafes", label: "Cafes", emoji: "☕" },
  { value: "shopping", label: "Shopping", emoji: "🛍️" },
  { value: "kid-friendly", label: "Kid-friendly", emoji: "🧸" },
] as const;

export const AI_TRAVEL_MODE_OPTIONS: {
  value: TravelMode;
  label: string;
}[] = [
  { value: "walking", label: "Walking" },
  { value: "transit", label: "Transit" },
  { value: "bicycling", label: "Bicycling" },
  { value: "driving", label: "Driving" },
];

export const AI_VISITS_PER_DAY_MIN = 1;
export const AI_VISITS_PER_DAY_MAX = 5;

// Cap for AI generation only; trips themselves may be longer. 180 days covers
// visa-length long stays (90-day Schengen, 180-day visitor stays, semesters)
// while bounding the date grid the planner model has to track.
export const AI_PLANNING_MAX_TRIP_DAYS = 180;

// On a coverage trip the plan cannot fill every day, but it must still use
// most of the catalog; below this share it reads as underfilled, not paced.
export const AI_COVERAGE_MIN_CATALOG_FRACTION = 0.8;

// A trip needs coverage mode (sightseeing days plus free days) when even the
// minimum pace across every day would exceed the curated catalog.
export function isAiCoverageTrip(
  days: number,
  visitsPerDayMin: number,
  candidateCount: number,
): boolean {
  return days * visitsPerDayMin > candidateCount;
}

export function aiCoverageMinTotalVisits(candidateCount: number): number {
  return Math.floor(candidateCount * AI_COVERAGE_MIN_CATALOG_FRACTION);
}

// How many sightseeing days the catalog supports at the given pace. The upper
// bound comes from stretching the catalog at minimum pace; the lower bound from
// packing it at maximum pace, clamped because a final partial day below the
// minimum pace is not a valid sightseeing day.
export function aiCoverageSightseeingDayRange(
  candidateCount: number,
  visitsPerDayMin: number,
  visitsPerDayMax: number,
): { minDays: number; maxDays: number } {
  const maxDays = Math.max(1, Math.floor(candidateCount / visitsPerDayMin));
  const minDays = Math.min(
    Math.max(1, Math.ceil(candidateCount / visitsPerDayMax)),
    maxDays,
  );
  return { minDays, maxDays };
}

export const AI_CREATE_ITINERARY_LABEL = "Create itinerary";

export const AI_PACE_PRESETS = [
  {
    label: "Relaxed",
    min: 1,
    max: 2,
    descriptor: "Slow mornings, room to wander.",
  },
  {
    label: "Balanced",
    min: 2,
    max: 3,
    descriptor: "A full day without the rush.",
  },
  {
    label: "Packed",
    min: 3,
    max: 5,
    descriptor: "Fit in as much as you can.",
  },
] as const;

const MS_PER_DAY = 86_400_000;

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

export const AI_DEFAULT_PLANNING_PREFERENCES: AiPlanningPreferenceInput = {
  visits_per_day_min: 2,
  visits_per_day_max: 3,
  interest_tags: [],
  avoid_interest_tags: [],
  preferred_travel_modes: ["walking", "transit"],
  must_see_candidate_ids: [],
};

export const AI_DEFAULT_DAILY_START_TIME = "09:00";

const INTEREST_TAG_VALUES = new Set<string>(
  AI_INTEREST_TAG_OPTIONS.map((option) => option.value),
);
const TRAVEL_MODE_VALUES = new Set<TravelMode>(
  AI_TRAVEL_MODE_OPTIONS.map((option) => option.value),
);

export function buildAiPlanningPreferenceDraft(
  setup: AiPlanningSetup | null,
): AiPlanningPreferenceInput {
  const preferences = setup?.preferences ?? AI_DEFAULT_PLANNING_PREFERENCES;
  const candidateIds = new Set(setup?.candidates.map((candidate) => candidate.id));
  const preferredTravelModes = unique(
    preferences.preferred_travel_modes.filter((mode) =>
      TRAVEL_MODE_VALUES.has(mode),
    ),
  );

  const interestTags = unique(
    preferences.interest_tags.filter((tag) => INTEREST_TAG_VALUES.has(tag)),
  );

  return {
    visits_per_day_min: clampVisitCount(preferences.visits_per_day_min),
    visits_per_day_max: clampVisitCount(preferences.visits_per_day_max),
    interest_tags: interestTags,
    // Interests win when saved data overlaps, so the draft never starts with a
    // tag both chosen and avoided.
    avoid_interest_tags: unique(
      preferences.avoid_interest_tags.filter(
        (tag) => INTEREST_TAG_VALUES.has(tag) && !interestTags.includes(tag),
      ),
    ),
    preferred_travel_modes:
      preferredTravelModes.length > 0
        ? preferredTravelModes
        : [...AI_DEFAULT_PLANNING_PREFERENCES.preferred_travel_modes],
    must_see_candidate_ids: unique(
      preferences.must_see_candidate_ids.filter((id) => candidateIds.has(id)),
    ),
  };
}

export function formatVisitsPerDayRangeLabel(
  minVisits: number,
  maxVisits: number,
): string {
  return minVisits === maxVisits
    ? `${maxVisits} visits/day`
    : `${minVisits}-${maxVisits} visits/day`;
}

export function isAiInterestTag(value: string): boolean {
  return INTEREST_TAG_VALUES.has(value);
}

export function estimateStopCount(
  minVisits: number,
  maxVisits: number,
  days: number,
): number {
  return Math.round(((minVisits + maxVisits) / 2) * days);
}

export function countTripDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

// The two halves of the AI-planning date gate, shared by the client's muted
// hint and the server's generation guard so they cannot drift apart.
export function hasAiPlanningDateRange<
  T extends Pick<Trip, "start_date" | "end_date">,
>(trip: T | null): trip is T & { start_date: string; end_date: string } {
  if (!trip?.start_date || !trip.end_date) {
    return false;
  }

  return (
    isValidIsoDate(trip.start_date) &&
    isValidIsoDate(trip.end_date) &&
    trip.start_date <= trip.end_date
  );
}

// The cap gates AI generation only; the trip itself may be longer.
export function exceedsAiPlanningTripLength(
  trip: Pick<Trip, "start_date" | "end_date"> | null,
): boolean {
  if (!hasAiPlanningDateRange(trip)) {
    return false;
  }

  return (
    countTripDays(trip.start_date, trip.end_date) > AI_PLANNING_MAX_TRIP_DAYS
  );
}

export function formatTripDateRangeShort(
  startDate: string,
  endDate: string,
): string {
  const start = SHORT_DATE_FORMATTER.format(new Date(`${startDate}T00:00:00Z`));
  if (startDate === endDate) return start;
  const end = SHORT_DATE_FORMATTER.format(new Date(`${endDate}T00:00:00Z`));
  return `${start} – ${end}`;
}

function clampVisitCount(value: number): number {
  if (!Number.isInteger(value)) return 3;
  return Math.min(
    AI_VISITS_PER_DAY_MAX,
    Math.max(AI_VISITS_PER_DAY_MIN, value),
  );
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
