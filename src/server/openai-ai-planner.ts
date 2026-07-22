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
} from "./openai-response";

export type AiItineraryPlan = {
  days: Array<{
    date: string;
    visits: Array<{
      candidate_id: number;
      start_time: string;
      duration_minutes: number;
      notes: string | null;
    }>;
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
  validationErrors: string[];
};

// Hard ceiling on web_search tool calls per itinerary generation. Searches
// verify only the places being scheduled (operation + opening days for the
// actual trip dates), so the budget stays small and the run bounded.
export const AI_ITINERARY_MAX_WEB_SEARCHES = 6;

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
};

const SYSTEM_PROMPT = [
  "Create a timed attraction-only itinerary from the provided curated candidates.",
  "Do not add restaurants, meals, or places outside the candidate list.",
  "Use only candidate IDs in the response.",
  "Respect the trip dates, preferred visit-count range, must-see IDs, and travel modes.",
  "When lodging is provided, use it as the daily start anchor and do not schedule it as an attraction.",
  "Use the provided daily_start_time as the time each day starts from lodging; the first attraction should account for realistic travel time from lodging to the first attraction.",
  "When trip_start_point is provided, the first trip day begins at trip_start_point rather than starting the day at lodging; when it has no time, start from daily_start_time and treat that as the moment you leave the start point.",
  `After arriving at trip_start_point at its given time, reserve buffer time before you can leave the hub: about ${AIRPORT_ARRIVAL_BUFFER_MINUTES} minutes when trip_start_point.type is "airport" (deplaning, immigration, and baggage) and about ${DEFAULT_ARRIVAL_BUFFER_MINUTES} minutes for train, bus, ferry, or custom stops. When lodging is also provided, the first trip day goes from trip_start_point to lodging to drop off bags before sightseeing, so the first attraction's start time must allow travel from trip_start_point to lodging and then from lodging to that attraction; otherwise add realistic travel time straight from trip_start_point to the first attraction. Do not schedule trip_start_point or lodging as attractions.`,
  `When trip_end_point is provided, the last day's final attractions must finish early enough to reach it and be there before its given time with buffer: about ${AIRPORT_DEPARTURE_BUFFER_MINUTES} minutes early when trip_end_point.type is "airport" (check-in, security, and boarding) and about ${DEFAULT_DEPARTURE_BUFFER_MINUTES} minutes early for train, bus, ferry, or custom stops, plus realistic travel time to reach it. Keep the last day's final attractions convenient to it and do not schedule it as an attraction.`,
  "Use 10-minute increments for all visit start times, for example 09:00, 09:10, 09:20, 09:30, 09:40, or 09:50.",
  "Use candidate planning notes when relevant, for example booking recommendations.",
  "If validation errors are provided, repair only those issues.",
].join(" ");

const WEB_SEARCH_VERIFICATION_PROMPT = [
  `Use at most ${AI_ITINERARY_MAX_WEB_SEARCHES} web searches, and only to verify places you intend to schedule: confirm they currently operate and check their opening days and hours against the trip dates.`,
  "Never schedule a place on a day it is closed; move it to another day or pick another candidate instead.",
  "When a search reveals a booking requirement, seasonal closure, or unusual hours, mention it briefly in that visit's notes.",
  "If a must-see candidate appears to be closed, keep it scheduled and add a clear warning note rather than dropping it.",
].join(" ");

export async function requestAiItineraryPlan({
  apiKey,
  model,
  context,
  enableWebSearch = false,
  fetchImpl = fetch,
}: RequestOptions): Promise<RequestResult> {
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
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
              text: enableWebSearch
                ? `${SYSTEM_PROMPT} ${WEB_SEARCH_VERIFICATION_PROMPT}`
                : SYSTEM_PROMPT,
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
          schema: AI_ITINERARY_PLAN_SCHEMA,
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
  };
}

const AI_ITINERARY_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["days"],
  properties: {
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "visits"],
        properties: {
          date: { type: "string" },
          visits: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "candidate_id",
                "start_time",
                "duration_minutes",
                "notes",
              ],
              properties: {
                candidate_id: { type: "integer" },
                start_time: { type: "string" },
                duration_minutes: { type: "integer" },
                notes: { type: ["string", "null"] },
              },
            },
          },
        },
      },
    },
  },
};

