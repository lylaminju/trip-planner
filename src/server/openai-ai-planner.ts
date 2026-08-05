import type {
  AiDestinationCandidate,
  AiPlanningPreferenceInput,
  AiTransitHubType,
  Trip,
  TripLodging,
} from "@/lib/types";
import {
  AIRPORT_ARRIVAL_BUFFER_MINUTES,
  AIRPORT_DEPARTURE_BUFFER_MINUTES,
  DEFAULT_ARRIVAL_BUFFER_MINUTES,
  DEFAULT_DEPARTURE_BUFFER_MINUTES,
} from "@/lib/transit-buffers";

import { AiUpstreamRateLimitError } from "./errors";
import {
  extractOutputText,
  openAiFailureDetail,
  openAiRetryAfterSeconds,
  openAiUsageTokens,
  openAiWebSearchCalls,
  type OpenAiWebSearchCall,
} from "./openai-response";

export type AiPlanLunchCandidate = {
  name: string;
  latitude: number;
  longitude: number;
  notes: string | null;
};

// One shared time slot with the model's ranked venue options (best first).
// Verification fetches Google details in rank order and stops at the first
// candidate that passes its gates, so later entries are fallbacks.
export type AiPlanLunchSlot = {
  start_time: string;
  duration_minutes: number;
  candidates: AiPlanLunchCandidate[];
};

export type AiItineraryPlan = {
  days: Array<{
    date: string;
    visits: Array<{
      candidate_id: number;
      start_time: string;
      duration_minutes: number;
      notes: string | null;
    }>;
    // Present only when the trip's preferences enable lunch stops; null on a
    // day the model found no workable pick. Unlike visits, lunch venues are the
    // model's own suggestions (name + coordinates), not catalog candidates.
    lunch?: AiPlanLunchSlot | null;
  }>;
};

export type AiPlannerTransitPointContext = {
  name: string;
  latitude: number;
  longitude: number;
  // Hub type when known, so the model can size airport vs. other-hub buffers;
  // null for custom points, which use the smaller non-airport buffer.
  type: AiTransitHubType | null;
  time: string | null;
};

export type AiPlannerPromptContext = {
  trip: Pick<Trip, "destination" | "start_date" | "end_date">;
  preferences: AiPlanningPreferenceInput;
  lodging: Pick<TripLodging, "name" | "latitude" | "longitude"> | null;
  daily_start_time: string;
  trip_start_point: AiPlannerTransitPointContext | null;
  trip_end_point: AiPlannerTransitPointContext | null;
  candidates: Array<
    Pick<
      AiDestinationCandidate,
      | "id"
      | "name"
      | "category"
      | "tags"
      | "area"
      | "region_distance_tier"
      | "typical_duration_minutes"
      | "planning_note"
    >
  >;
  tripDates: string[];
  // Present when the trip is longer than the catalog can fill at the requested
  // pace: the plan covers sightseeing days plus free days instead of every day.
  coverage: { min_total_visits: number } | null;
  validationErrors: string[];
};

// Hard ceiling on web_search tool calls per itinerary generation. Searches
// verify only the places being scheduled (operation + opening days for the
// actual trip dates), so the budget stays small and the run bounded.
export const AI_ITINERARY_MAX_WEB_SEARCHES = 6;

// gpt-5.4-mini defaults to reasoning effort "none", which cannot track the
// trip-wide constraints (no repeated candidates, every must-see exactly once,
// total visits bounded by catalog size) on long trips. "low" buys that
// bookkeeping for a modest reasoning-token cost.
export const AI_ITINERARY_REASONING_EFFORT = "low";

type RequestOptions = {
  apiKey: string;
  model: string;
  context: AiPlannerPromptContext;
  // Primary generation verifies scheduled places with web search; the repair
  // attempt runs without it so a validation failure never doubles search spend.
  enableWebSearch?: boolean;
  fetchImpl?: typeof fetch;
};

type RequestResult = {
  plan: AiItineraryPlan;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
  };
  // Web searches the model actually executed; always [] when the web_search
  // tool was not attached (repairs, guests).
  webSearchCalls: OpenAiWebSearchCall[];
};

// Lunch scheduling window and pacing; validation enforces the same bounds.
export const AI_LUNCH_EARLIEST_START_TIME = "12:00";
export const AI_LUNCH_LATEST_START_TIME = "15:00";
export const AI_LUNCH_MIN_DURATION_MINUTES = 30;
export const AI_LUNCH_MAX_DURATION_MINUTES = 120;
// Ranked venue options per lunch slot. Two covers the common failure (top pick
// closed or unmatched) at minimal token cost; revisit against the
// lunch_verification_log before expanding.
export const AI_LUNCH_CANDIDATE_COUNT = 2;

const SYSTEM_PROMPT_INTRO =
  "Create a timed attraction-only itinerary from the provided curated candidates.";

const NO_RESTAURANTS_RULE =
  "Do not add restaurants, meals, or places outside the candidate list.";

const LUNCH_RULES = [
  "preferences.include_lunch_stop is on: besides the attraction visits, schedule one lunch slot per planned day in that day's lunch field, close to where the traveler is around midday. Set lunch to null only when a day has no workable option.",
  `Each lunch slot lists exactly ${AI_LUNCH_CANDIDATE_COUNT} candidate restaurants, your best pick first — real, currently operating, genuinely different venues (not two branches or near-clones), all reachable from the slot's location.`,
  "Every candidate must match preferences.dining_budget (budget = inexpensive local spots, moderate = mid-range, upscale = a notable dining experience; unset = use your judgment), suit every preferences.dietary_tags value, and be consistent with preferences.dietary_notes.",
  `Lunch start_time must be between ${AI_LUNCH_EARLIEST_START_TIME} and ${AI_LUNCH_LATEST_START_TIME} on the same 10-minute grid, must not overlap attraction visits, and duration_minutes should be realistic (${AI_LUNCH_MIN_DURATION_MINUTES}-${AI_LUNCH_MAX_DURATION_MINUTES}).`,
  "Give each candidate's real coordinates and its exact commonly used name. In each candidate's notes, say briefly why it fits (signature dish or vibe).",
  'When dietary_tags or dietary_notes are set, end each candidate\'s notes with: "Confirm dietary needs with the restaurant."',
  "Apart from the lunch field, do not add restaurants, meals, or places outside the candidate list.",
].join(" ");

const SYSTEM_PROMPT = [
  "Use only candidate IDs in the response.",
  "Respect the trip dates, preferred visit-count range, must-see IDs, and travel modes.",
  "Schedule each candidate at most once across the entire trip; never plan a return visit to a place already scheduled on another day.",
  "Every must-see ID must appear in the plan exactly once.",
  "When lodging is provided, use it as the daily start anchor and do not schedule it as an attraction.",
  "Use the provided daily_start_time as the time each day starts from lodging; the first attraction should account for realistic travel time from lodging to the first attraction.",
  "When trip_start_point is provided, the first trip day begins at trip_start_point rather than starting the day at lodging; when it has no time, start from daily_start_time and treat that as the moment you leave the start point.",
  `After arriving at trip_start_point at its given time, reserve buffer time before you can leave the hub: about ${AIRPORT_ARRIVAL_BUFFER_MINUTES} minutes when trip_start_point.type is "airport" (deplaning, immigration, and baggage) and about ${DEFAULT_ARRIVAL_BUFFER_MINUTES} minutes for train, bus, ferry, or custom stops. When lodging is also provided, the first trip day goes from trip_start_point to lodging to drop off bags before sightseeing, so the first attraction's start time must allow travel from trip_start_point to lodging and then from lodging to that attraction; otherwise add realistic travel time straight from trip_start_point to the first attraction. Do not schedule trip_start_point or lodging as attractions.`,
  `When trip_end_point is provided, the last day's final attractions must finish early enough to reach it and be there before its given time with buffer: about ${AIRPORT_DEPARTURE_BUFFER_MINUTES} minutes early when trip_end_point.type is "airport" (check-in, security, and boarding) and about ${DEFAULT_DEPARTURE_BUFFER_MINUTES} minutes early for train, bus, ferry, or custom stops, plus realistic travel time to reach it. Keep the last day's final attractions convenient to it and do not schedule it as an attraction.`,
  "Use 10-minute increments for all visit start times, for example 09:00, 09:10, 09:20, 09:30, 09:40, or 09:50.",
  "Use candidate planning notes when relevant, for example booking recommendations.",
  "When coverage is null, plan every trip date.",
  "When coverage is provided, the trip is longer than the curated candidate list can fill at the requested visits-per-day pace, so plan sightseeing days plus free days: schedule at least coverage.min_total_visits visits in total, keep every planned day within the requested visits-per-day range, spread the sightseeing days across the whole trip, and group candidates in the same area on the same day.",
  "When coverage is provided, omit free days from the response entirely instead of returning days with no visits, but still plan the first trip date when trip_start_point is given and the last trip date when trip_end_point is given.",
  "If validation errors are provided, repair only those issues.",
].join(" ");

const WEB_SEARCH_VERIFICATION_PROMPT = [
  `Use at most ${AI_ITINERARY_MAX_WEB_SEARCHES} web searches, and only to verify places you intend to schedule: confirm they currently operate and check their opening days and hours against the trip dates.`,
  "Never schedule a place on a day it is closed; move it to another day or pick another candidate instead.",
  "When a search reveals a booking requirement, seasonal closure, or unusual hours, mention it briefly in that visit's notes.",
  "If a must-see candidate appears to be closed, keep it scheduled and add a clear warning note rather than dropping it.",
].join(" ");

// Lunch swaps the blanket no-restaurants rule for the lunch-field contract;
// everything else in the prompt is shared between the two modes.
function plannerSystemPrompt(input: {
  includeLunch: boolean;
  enableWebSearch: boolean;
}): string {
  return [
    SYSTEM_PROMPT_INTRO,
    input.includeLunch ? LUNCH_RULES : NO_RESTAURANTS_RULE,
    SYSTEM_PROMPT,
    ...(input.enableWebSearch ? [WEB_SEARCH_VERIFICATION_PROMPT] : []),
  ].join(" ");
}

export async function requestAiItineraryPlan({
  apiKey,
  model,
  context,
  enableWebSearch = false,
  fetchImpl = fetch,
}: RequestOptions): Promise<RequestResult> {
  const includeLunch = context.preferences.include_lunch_stop === true;
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: AI_ITINERARY_REASONING_EFFORT },
      ...(enableWebSearch
        ? {
            tools: [{ type: "web_search" }],
            max_tool_calls: AI_ITINERARY_MAX_WEB_SEARCHES,
          }
        : {}),
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: plannerSystemPrompt({ includeLunch, enableWebSearch }),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(context),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ai_itinerary_plan",
          strict: true,
          schema: aiItineraryPlanSchema(includeLunch),
        },
      },
    }),
  });
  // OpenAI errors can arrive as HTML gateway pages, so parse defensively.
  const body: unknown = await response.json().catch(() => null);

  if (response.status === 429) {
    throw new AiUpstreamRateLimitError(
      openAiFailureDetail(body, response.status),
      openAiRetryAfterSeconds(response, body),
    );
  }
  if (!response.ok || body === null) {
    throw new Error(
      `OpenAI itinerary generation failed: ${openAiFailureDetail(body, response.status)}`,
    );
  }

  return {
    plan: JSON.parse(extractOutputText(body)) as AiItineraryPlan,
    usage: openAiUsageTokens(body),
    webSearchCalls: openAiWebSearchCalls(body),
  };
}

const AI_PLAN_VISITS_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["candidate_id", "start_time", "duration_minutes", "notes"],
    properties: {
      candidate_id: { type: "integer" },
      start_time: { type: "string" },
      duration_minutes: { type: "integer" },
      notes: { type: ["string", "null"] },
    },
  },
};

const AI_PLAN_LUNCH_SCHEMA = {
  type: ["object", "null"],
  additionalProperties: false,
  required: ["start_time", "duration_minutes", "candidates"],
  properties: {
    start_time: { type: "string" },
    duration_minutes: { type: "integer" },
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "latitude", "longitude", "notes"],
        properties: {
          name: { type: "string" },
          latitude: { type: "number" },
          longitude: { type: "number" },
          notes: { type: ["string", "null"] },
        },
      },
    },
  },
};

// Without lunch the schema is byte-identical to the pre-dining contract, so
// generations with the toggle off (and all guests) keep their exact behavior.
function aiItineraryPlanSchema(includeLunch: boolean) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["days"],
    properties: {
      days: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: includeLunch
            ? ["date", "visits", "lunch"]
            : ["date", "visits"],
          properties: {
            date: { type: "string" },
            visits: AI_PLAN_VISITS_SCHEMA,
            ...(includeLunch ? { lunch: AI_PLAN_LUNCH_SCHEMA } : {}),
          },
        },
      },
    },
  };
}

