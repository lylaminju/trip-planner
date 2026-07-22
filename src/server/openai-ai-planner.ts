import type {
  AiDestinationCandidate,
  AiPlanningPreferenceInput,
  Trip,
  TripLodging,
} from "@/lib/types";

import { AiUpstreamRateLimitError } from "./errors";
import {
  extractOutputText,
  openAiFailureDetail,
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

type RequestOptions = {
  apiKey: string;
  model: string;
  context: AiPlannerPromptContext;
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
  "When trip_start_point is provided, the first trip day begins there instead of lodging, starting at its time when given (otherwise daily_start_time); plan the first day's attractions accounting for travel from that point and do not schedule it as an attraction.",
  "When trip_end_point is provided, the last day's visits must finish with enough time to reach it, before its time when given; keep the last day's final attractions convenient to it and do not schedule it as an attraction.",
  "Use 10-minute increments for all visit start times, for example 09:00, 09:10, 09:20, 09:30, 09:40, or 09:50.",
  "Use candidate planning notes when relevant, for example booking recommendations.",
  "If validation errors are provided, repair only those issues.",
].join(" ");

export async function requestAiItineraryPlan({
  apiKey,
  model,
  context,
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
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: SYSTEM_PROMPT }],
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

