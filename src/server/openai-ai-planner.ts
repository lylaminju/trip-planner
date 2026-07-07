import type {
  AiDestinationCandidate,
  AiPlanningPreferenceInput,
  Trip,
  TripLodging,
} from "@/lib/types";

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

export type AiPlannerPromptContext = {
  trip: Pick<Trip, "destination" | "start_date" | "end_date">;
  preferences: AiPlanningPreferenceInput;
  lodging: Pick<TripLodging, "name" | "address" | "latitude" | "longitude"> | null;
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
  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      `OpenAI itinerary generation failed: ${openAiErrorMessage(body)}`,
    );
  }

  return {
    plan: JSON.parse(extractOutputText(body)) as AiItineraryPlan,
    usage: {
      inputTokens:
        typeof body?.usage?.input_tokens === "number"
          ? body.usage.input_tokens
          : null,
      outputTokens:
        typeof body?.usage?.output_tokens === "number"
          ? body.usage.output_tokens
          : null,
    },
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

function extractOutputText(body: unknown): string {
  if (hasStringProperty(body, "output_text")) {
    return body.output_text;
  }

  const output = objectProperty(body, "output");
  if (Array.isArray(output)) {
    for (const item of output) {
      if (
        typeof item === "object" &&
        item !== null &&
        Array.isArray(item.content)
      ) {
        for (const content of item.content) {
          if (hasStringProperty(content, "text")) {
            return content.text;
          }
        }
      }
    }
  }

  throw new Error("OpenAI itinerary generation returned no output text.");
}

function openAiErrorMessage(body: unknown): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }

  return "Unknown error";
}

function hasStringProperty<K extends string>(
  value: unknown,
  key: K,
): value is Record<K, string> {
  const record = value as Record<string, unknown>;
  return (
    typeof value === "object" &&
    value !== null &&
    key in value &&
    typeof record[key] === "string"
  );
}

function objectProperty(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return (value as Record<string, unknown>)[key];
}
