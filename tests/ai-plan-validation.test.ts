import { describe, expect, it } from "vitest";

import { validateAiItineraryPlan } from "@/server/ai-plan-validation";
import type { AiItineraryPlan } from "@/server/openai-ai-planner";

describe("AI itinerary plan validation", () => {
  it("accepts a timed plan using curated candidates inside the trip dates", () => {
    const result = validateAiItineraryPlan(plan(), {
      candidateIds: new Set([10, 11]),
      tripDates: ["2026-05-27"],
      visitsPerDayMax: 3,
    });

    expect(result).toEqual({ status: "valid", errors: [] });
  });

  it("rejects unknown candidates, invalid dates, invalid times, and rushed days", () => {
    const result = validateAiItineraryPlan(
      {
        days: [
          {
            date: "2026-05-29",
            visits: [
              {
                candidate_id: 99,
                start_time: "25:00",
                duration_minutes: 60,
                notes: null,
              },
              {
                candidate_id: 10,
                start_time: "09:00",
                duration_minutes: 60,
                notes: null,
              },
            ],
          },
        ],
      },
      {
        candidateIds: new Set([10]),
        tripDates: ["2026-05-27"],
        visitsPerDayMax: 1,
      },
    );

    expect(result.status).toBe("invalid");
    expect(result.errors).toContain("Day 2026-05-29 is outside the trip.");
    expect(result.errors).toContain("Candidate 99 is not in the curated list.");
    expect(result.errors).toContain("Visit time 25:00 must be HH:MM.");
    expect(result.errors).toContain(
      "Day 2026-05-29 has more visits than requested.",
    );
  });
});

function plan(): AiItineraryPlan {
  return {
    days: [
      {
        date: "2026-05-27",
        visits: [
          {
            candidate_id: 10,
            start_time: "09:00",
            duration_minutes: 120,
            notes: "Start outdoors.",
          },
          {
            candidate_id: 11,
            start_time: "13:00",
            duration_minutes: 90,
            notes: null,
          },
        ],
      },
    ],
  };
}
