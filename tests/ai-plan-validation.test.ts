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

  it("accepts a valid lunch stop and treats a null lunch as fine", () => {
    const base = {
      candidateIds: new Set([10]),
      tripDates: ["2026-05-27"],
      visitsPerDayMin: 1,
      visitsPerDayMax: 3,
      mustSeeCandidateIds: [],
    };
    const day = {
      date: "2026-05-27",
      visits: [
        {
          candidate_id: 10,
          start_time: "09:00",
          duration_minutes: 120,
          notes: null,
        },
      ],
    };

    expect(
      validateAiItineraryPlan(
        {
          days: [
            {
              ...day,
              lunch: {
                name: "Chez Janou",
                latitude: 48.856,
                longitude: 2.365,
                start_time: "12:30",
                duration_minutes: 60,
                notes: null,
              },
            },
          ],
        },
        base,
      ),
    ).toEqual({ status: "valid", errors: [] });

    expect(
      validateAiItineraryPlan({ days: [{ ...day, lunch: null }] }, base),
    ).toEqual({ status: "valid", errors: [] });
  });

  it("rejects a lunch with a blank name, bad coordinates, off-window time, or bad duration", () => {
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
            lunch: {
              name: "  ",
              latitude: 148.856,
              longitude: -200,
              start_time: "10:00",
              duration_minutes: 10,
              notes: null,
            },
          },
        ],
      },
      {
        candidateIds: new Set([10]),
        tripDates: ["2026-05-27"],
        visitsPerDayMin: 1,
        visitsPerDayMax: 3,
        mustSeeCandidateIds: [],
      },
    );

    expect(result.status).toBe("invalid");
    expect(result.errors).toEqual([
      "Day 2026-05-27 lunch must have a restaurant name.",
      "Day 2026-05-27 lunch latitude is invalid.",
      "Day 2026-05-27 lunch longitude is invalid.",
      "Day 2026-05-27 lunch must start between 11:00 and 15:00.",
      "Day 2026-05-27 lunch duration must be 30-120 minutes.",
    ]);
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

  it("accepts visits that start at the lodging start time", () => {
    const result = validateAiItineraryPlan(plan(), {
      candidateIds: new Set([10, 11]),
      tripDates: ["2026-05-27"],
      visitsPerDayMin: 1,
      visitsPerDayMax: 3,
      mustSeeCandidateIds: [],
      earliestVisitStartTime: "09:00",
    });

    expect(result).toEqual({ status: "valid", errors: [] });
  });

  it("rejects visits before the lodging start time", () => {
    const result = validateAiItineraryPlan(
      {
        days: [
          {
            date: "2026-05-27",
            visits: [
              {
                candidate_id: 10,
                start_time: "08:30",
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
        visitsPerDayMin: 1,
        visitsPerDayMax: 3,
        mustSeeCandidateIds: [],
        earliestVisitStartTime: "09:00",
      },
    );

    expect(result.status).toBe("invalid");
    expect(result.errors).toContain(
      "Day 2026-05-27 has a visit before 09:00.",
    );
  });

  it("applies the arrival-time floor only to the first trip day", () => {
    const result = validateAiItineraryPlan(
      {
        days: [
          {
            date: "2026-05-27",
            visits: [
              {
                candidate_id: 10,
                start_time: "14:00",
                duration_minutes: 60,
                notes: null,
              },
            ],
          },
          {
            date: "2026-05-28",
            visits: [
              {
                candidate_id: 11,
                start_time: "09:30",
                duration_minutes: 60,
                notes: null,
              },
            ],
          },
        ],
      },
      {
        candidateIds: new Set([10, 11]),
        tripDates: ["2026-05-27", "2026-05-28"],
        visitsPerDayMin: 1,
        visitsPerDayMax: 3,
        mustSeeCandidateIds: [],
        earliestVisitStartTime: "09:00",
        firstDayEarliestStartTime: "15:00",
      },
    );

    expect(result.status).toBe("invalid");
    expect(result.errors).toEqual([
      "Day 2026-05-27 has a visit before 15:00.",
    ]);
  });

  it("rejects last-day visits that end after the departure time", () => {
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
        visitsPerDayMin: 1,
        visitsPerDayMax: 3,
        mustSeeCandidateIds: [],
        lastDayLatestEndTime: "10:30",
      },
    );

    expect(result.status).toBe("invalid");
    expect(result.errors).toContain(
      "Day 2026-05-27 has a visit ending after 10:30.",
    );
  });

  it("rejects days whose visits share or repeat a start time", () => {
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
              {
                candidate_id: 11,
                start_time: "09:00",
                duration_minutes: 90,
                notes: null,
              },
            ],
          },
        ],
      },
      {
        candidateIds: new Set([10, 11]),
        tripDates: ["2026-05-27"],
        visitsPerDayMin: 1,
        visitsPerDayMax: 3,
        mustSeeCandidateIds: [],
      },
    );

    expect(result.status).toBe("invalid");
    expect(result.errors).toContain(
      "Day 2026-05-27 has visits that are not in increasing start-time order.",
    );
  });

  it("accepts free days in coverage mode when the visit floor is met", () => {
    const result = validateAiItineraryPlan(plan(), {
      candidateIds: new Set([10, 11]),
      tripDates: ["2026-05-27", "2026-05-28", "2026-05-29"],
      visitsPerDayMin: 1,
      visitsPerDayMax: 3,
      mustSeeCandidateIds: [],
      coverage: {
        minTotalVisits: 2,
        requireFirstTripDate: false,
        requireLastTripDate: false,
      },
    });

    expect(result).toEqual({ status: "valid", errors: [] });
  });

  it("rejects a coverage plan that schedules fewer visits than the floor", () => {
    const result = validateAiItineraryPlan(plan(), {
      candidateIds: new Set([10, 11]),
      tripDates: ["2026-05-27", "2026-05-28", "2026-05-29"],
      visitsPerDayMin: 1,
      visitsPerDayMax: 3,
      mustSeeCandidateIds: [],
      coverage: {
        minTotalVisits: 3,
        requireFirstTripDate: false,
        requireLastTripDate: false,
      },
    });

    expect(result.status).toBe("invalid");
    expect(result.errors).toContain(
      "Plan schedules only 2 visits; schedule at least 3 curated candidates.",
    );
  });

  it("requires arrival and departure days to stay planned in coverage mode", () => {
    const result = validateAiItineraryPlan(plan(), {
      candidateIds: new Set([10, 11]),
      tripDates: ["2026-05-26", "2026-05-27", "2026-05-28"],
      visitsPerDayMin: 1,
      visitsPerDayMax: 3,
      mustSeeCandidateIds: [],
      coverage: {
        minTotalVisits: 2,
        requireFirstTripDate: true,
        requireLastTripDate: true,
      },
    });

    expect(result.status).toBe("invalid");
    expect(result.errors).toContain(
      "Day 2026-05-26 must be planned because trip_start_point is on that day.",
    );
    expect(result.errors).toContain(
      "Day 2026-05-28 must be planned because trip_end_point is on that day.",
    );
  });

  it("keeps per-day pace rules on planned days in coverage mode", () => {
    const result = validateAiItineraryPlan(plan(), {
      candidateIds: new Set([10, 11]),
      tripDates: ["2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30"],
      visitsPerDayMin: 3,
      visitsPerDayMax: 5,
      mustSeeCandidateIds: [],
      coverage: {
        minTotalVisits: 2,
        requireFirstTripDate: false,
        requireLastTripDate: false,
      },
    });

    expect(result.status).toBe("invalid");
    expect(result.errors).toContain(
      "Day 2026-05-27 has fewer visits than requested.",
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
