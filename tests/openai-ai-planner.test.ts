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
    expect(body.input[0].content[0].text).toContain(
      'about 60 minutes when trip_start_point.type is "airport"',
    );
    expect(body.input[0].content[0].text).toContain(
      'about 150 minutes early when trip_end_point.type is "airport"',
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

  it("verifies scheduled places with capped web search on the primary call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        output_text: JSON.stringify({ days: [] }),
        usage: { input_tokens: 1, output_tokens: 2 },
      }),
    );

    await requestAiItineraryPlan({
      apiKey: "test-key",
      model: "gpt-5.5",
      context: promptContext(),
      enableWebSearch: true,
      fetchImpl: fetchMock,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toEqual([{ type: "web_search" }]);
    expect(body.max_tool_calls).toBe(6);
    expect(body.input[0].content[0].text).toContain(
      "opening days and hours against the trip dates",
    );
    expect(body.input[0].content[0].text).toContain(
      "keep it scheduled and add a clear warning note",
    );
  });

  it("runs without web search by default so the repair attempt stays cheap", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        output_text: JSON.stringify({ days: [] }),
        usage: { input_tokens: 1, output_tokens: 2 },
      }),
    );

    await requestAiItineraryPlan({
      apiKey: "test-key",
      model: "gpt-5.5",
      context: promptContext(),
      fetchImpl: fetchMock,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toBeUndefined();
    expect(body.max_tool_calls).toBeUndefined();
    expect(body.input[0].content[0].text).not.toContain("web search");
  });

  it("reports non-JSON OpenAI responses instead of raising a parse error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("<!DOCTYPE html>", { status: 502 }));

    await expect(
      requestAiItineraryPlan({
        apiKey: "test-key",
        model: "gpt-5.5",
        context: promptContext(),
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(
      "OpenAI itinerary generation failed: HTTP 502 with a non-JSON response",
    );
  });

  it("maps OpenAI 429 responses to a friendly rate-limit error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        { error: { message: "Rate limit reached on tokens per min (TPM)" } },
        { status: 429 },
      ),
    );

    await expect(
      requestAiItineraryPlan({
        apiKey: "test-key",
        model: "gpt-5.5",
        context: promptContext(),
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(
      "The AI service is handling too many requests right now. Please try again in a minute.",
    );
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
    trip_start_point: null,
    trip_end_point: null,
    candidates: [
      {
        id: 10,
        name: "Central Park",
        category: "park",
        tags: ["nature"],
        area: "Manhattan",
        region_distance_tier: "central",
        typical_duration_minutes: 120,
        planning_note: "Online booking recommended.",
      },
    ],
    tripDates: ["2026-05-27"],
    validationErrors: [],
  };
}
