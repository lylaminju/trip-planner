import { describe, expect, it, vi } from "vitest";

import {
  requestAiItineraryPlan,
  type AiPlannerPromptContext,
} from "@/server/openai-ai-planner";

describe("OpenAI AI planner adapter", () => {
  it("requests a strict structured itinerary plan and parses output text", async () => {
    const plan = {
      days: [
        {
          date: "2026-05-27",
          visits: [
            {
              candidate_id: 10,
              start_time: "09:00",
              duration_minutes: 120,
              notes: "Start here.",
            },
          ],
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        output_text: JSON.stringify(plan),
        usage: {
          input_tokens: 111,
          output_tokens: 222,
        },
      }),
    );

    await expect(
      requestAiItineraryPlan({
        apiKey: "test-key",
        model: "gpt-5.5",
        context: promptContext(),
        fetchImpl: fetchMock,
      }),
    ).resolves.toEqual({
      plan,
      usage: {
        inputTokens: 111,
        outputTokens: 222,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "Bearer test-key",
          "content-type": "application/json",
        },
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("gpt-5.5");
    expect(JSON.parse(body.input[1].content[0].text).daily_start_time).toBe(
      "09:00",
    );
    expect(body.input[0].content[0].text).toContain(
      "travel time from lodging to the first attraction",
    );
    expect(body.input[0].content[0].text).toContain("10-minute increments");
    expect(body.text.format.type).toBe("json_schema");
    expect(body.text.format.strict).toBe(true);
    expect(body.text.format.schema.properties.days.type).toBe("array");
  });

  it("normalizes failed OpenAI responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ error: { message: "Bad request" } }, { status: 400 }),
    );

    await expect(
      requestAiItineraryPlan({
        apiKey: "test-key",
        model: "gpt-5.5",
        context: promptContext(),
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow("OpenAI itinerary generation failed: Bad request");
  });
});

function promptContext(): AiPlannerPromptContext {
  return {
    trip: {
      destination: "New York City",
      start_date: "2026-05-27",
      end_date: "2026-05-27",
    },
    preferences: {
      visits_per_day_min: 1,
      visits_per_day_max: 3,
      interest_tags: ["nature"],
      preferred_travel_modes: ["walking", "transit"],
      must_see_candidate_ids: [10],
    },
    lodging: null,
    daily_start_time: "09:00",
    candidates: [
      {
        id: 10,
        name: "Central Park",
        category: "park",
        tags: ["nature"],
        area: "Manhattan",
        region_distance_tier: "central",
        typical_duration_minutes: 120,
      },
    ],
    tripDates: ["2026-05-27"],
    validationErrors: [],
  };
}
