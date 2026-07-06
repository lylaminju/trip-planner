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
  { value: "neighborhoods", label: "Neighborhoods" },
  { value: "kid-friendly", label: "Kid-friendly" },
  { value: "low-cost-free", label: "Low-cost/free" },
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

export const AI_DEFAULT_PLANNING_PREFERENCES: AiPlanningPreferenceInput = {
  visits_per_day_min: 2,
  visits_per_day_max: 3,
  interest_tags: [],
  preferred_travel_modes: ["walking", "transit"],
  must_see_candidate_ids: [],
};

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

export function formatVisitsPerDayLabel(maxVisits: number): string {
  return `Up to ${maxVisits} visits/day`;
}

function clampVisitCount(value: number): number {
  if (!Number.isInteger(value)) return 3;
  return Math.min(4, Math.max(1, value));
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
