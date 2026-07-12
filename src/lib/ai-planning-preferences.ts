import type {
  AiPlanningPreferenceInput,
  AiPlanningSetup,
  TravelMode,
} from "./types";

export const AI_INTEREST_TAG_OPTIONS = [
  { value: "landmarks", label: "Landmarks" },
  { value: "museums", label: "Museums" },
  { value: "nature", label: "Nature" },
  { value: "viewpoints", label: "Viewpoints" },
  { value: "local-vibe", label: "Local vibe" },
  { value: "food", label: "Food & markets" },
  { value: "kid-friendly", label: "Kid-friendly" },
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

  return {
    visits_per_day_min: clampVisitCount(preferences.visits_per_day_min),
    visits_per_day_max: clampVisitCount(preferences.visits_per_day_max),
    interest_tags: unique(
      preferences.interest_tags.filter((tag) => INTEREST_TAG_VALUES.has(tag)),
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

export function describePace(minVisits: number, maxVisits: number): string {
  if (maxVisits <= 2) return "Relaxed";
  if (minVisits >= 3) return "Packed";
  return "Balanced";
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
