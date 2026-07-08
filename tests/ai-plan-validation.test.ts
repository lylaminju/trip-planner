import { describe, expect, it } from "vitest";

import { validateAiItineraryPlan } from "@/server/ai-plan-validation";
import type { AiItineraryPlan } from "@/server/openai-ai-planner";

describe("AI itinerary plan validation", () => {
  it("accepts a timed plan using curated candidates inside the trip dates", () => {
    const result = validateAiItineraryPlan(plan(), {
      candidateIds: new Set([10, 11]),
      tripDates: ["2026-05-27"],
      visitsPerDayMin: 1,
      visitsPerDayMax: 3,
      mustSeeCandidateIds: [],
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
        visitsPerDayMin: 1,
        visitsPerDayMax: 1,
        mustSeeCandidateIds: [],
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

  it("rejects plans that omit required trip days", () => {
    const result = validateAiItineraryPlan(
      {
        days: [
          {
            date: "2026-05-27",
            visits: [
              {
                candidate_id: 10,
                start_time: "09:00",
                duration_minutes: 120,
                notes: null,
              },
            ],
          },
        ],
      },
      {
        candidateIds: new Set([10]),
        tripDates: ["2026-05-27", "2026-05-28"],
        visitsPerDayMin: 1,
        visitsPerDayMax: 3,
        mustSeeCandidateIds: [],
      },
    );

    expect(result.status).toBe("invalid");
    expect(result.errors).toContain("Day 2026-05-28 is missing from the plan.");
  });

  it("rejects days with fewer visits than requested", () => {
    const result = validateAiItineraryPlan(
      {
        days: [
          {
            date: "2026-05-27",
            visits: [
              {
                candidate_id: 10,
                start_time: "09:00",
                duration_minutes: 120,
                notes: null,
              },
            ],
          },
        ],
      },
      {
        candidateIds: new Set([10]),
        tripDates: ["2026-05-27"],
        visitsPerDayMin: 2,
        visitsPerDayMax: 3,
        mustSeeCandidateIds: [],
      },
    );

    expect(result.status).toBe("invalid");
    expect(result.errors).toContain(
      "Day 2026-05-27 has fewer visits than requested.",
    );
  });

  it("rejects plans that omit must-see candidates", () => {
    const result = validateAiItineraryPlan(plan(), {
      candidateIds: new Set([10, 11, 12]),
      tripDates: ["2026-05-27"],
      visitsPerDayMin: 1,
      visitsPerDayMax: 3,
      mustSeeCandidateIds: [12],
    });

    expect(result.status).toBe("invalid");
    expect(result.errors).toContain(
      "Must-see candidate 12 is missing from the plan.",
    );
  });

  it("rejects visits that do not start after the lodging start time", () => {
    const result = validateAiItineraryPlan(plan(), {
      candidateIds: new Set([10, 11]),
      tripDates: ["2026-05-27"],
      visitsPerDayMin: 1,
      visitsPerDayMax: 3,
      mustSeeCandidateIds: [],
      firstVisitAfterTime: "09:00",
    });

    expect(result.status).toBe("invalid");
    expect(result.errors).toContain(
      "Day 2026-05-27 has a visit that does not start after 09:00.",
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
