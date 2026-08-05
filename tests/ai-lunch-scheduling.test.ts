import { describe, expect, it } from "vitest";

import { withLunchClearOfVisits } from "@/server/ai-lunch-scheduling";
import type { AiItineraryPlan } from "@/server/openai-ai-planner";

const DATE = "2026-09-23";

function visit(
  candidateId: number,
  startTime: string,
  durationMinutes: number,
): AiItineraryPlan["days"][number]["visits"][number] {
  return {
    candidate_id: candidateId,
    start_time: startTime,
    duration_minutes: durationMinutes,
    notes: null,
  };
}

function planWith(
  visits: AiItineraryPlan["days"][number]["visits"],
  lunchStartTime: string,
  lunchDurationMinutes = 90,
): AiItineraryPlan {
  return {
    days: [
      {
        date: DATE,
        visits,
        lunch: {
          start_time: lunchStartTime,
          duration_minutes: lunchDurationMinutes,
          candidates: [
            {
              name: "The Goodman Pub and Kitchen",
              latitude: 43.638,
              longitude: -79.382,
              notes: null,
            },
          ],
        },
      },
    ],
  };
}

function scheduleOf(plan: AiItineraryPlan) {
  const day = plan.days[0];
  return {
    visits: day.visits.map((entry) => entry.start_time),
    lunch: day.lunch?.start_time ?? null,
  };
}

describe("withLunchClearOfVisits", () => {
  it("hands lunch the slot of a long visit it would otherwise interrupt", () => {
    // Trip 88 day 3: lunch landed 90 minutes into a three-hour Toronto Islands
    // visit that runs past the lunch window, so lunch cannot simply wait.
    const plan = planWith(
      [visit(1, "10:20", 90), visit(2, "12:10", 180)],
      "13:40",
    );

    expect(scheduleOf(withLunchClearOfVisits(plan))).toEqual({
      visits: ["10:20", "13:40"],
      lunch: "12:10",
    });
  });

  it("shifts every later visit by the same amount so travel gaps survive", () => {
    const plan = planWith(
      [visit(1, "12:00", 120), visit(2, "14:30", 60), visit(3, "16:00", 60)],
      "12:30",
      60,
    );

    expect(scheduleOf(withLunchClearOfVisits(plan))).toEqual({
      visits: ["13:00", "15:30", "17:00"],
      lunch: "12:00",
    });
  });

  it("waits for a blocking visit that still ends inside the lunch window", () => {
    const plan = planWith(
      [visit(1, "12:00", 120), visit(2, "16:00", 60)],
      "12:30",
      60,
    );

    expect(scheduleOf(withLunchClearOfVisits(plan))).toEqual({
      visits: ["12:00", "16:00"],
      lunch: "14:00",
    });
  });

  it("leaves a lunch that already clears every visit untouched", () => {
    const plan = planWith(
      [visit(1, "10:20", 90), visit(2, "14:00", 120)],
      "12:30",
    );

    expect(scheduleOf(withLunchClearOfVisits(plan))).toEqual({
      visits: ["10:20", "14:00"],
      lunch: "12:30",
    });
  });

  it("keeps the model's times when one visit spans the whole lunch window", () => {
    const plan = planWith([visit(1, "09:30", 360)], "12:30");

    expect(scheduleOf(withLunchClearOfVisits(plan))).toEqual({
      visits: ["09:30"],
      lunch: "12:30",
    });
  });

  it("keeps the model's times when the last day cannot absorb the shift", () => {
    const plan = planWith(
      [visit(1, "10:20", 90), visit(2, "12:10", 180)],
      "13:40",
    );

    const rescheduled = withLunchClearOfVisits(plan, {
      lastTripDate: DATE,
      lastDayLatestEndTime: "16:00",
    });

    expect(scheduleOf(rescheduled)).toEqual({
      visits: ["10:20", "12:10"],
      lunch: "13:40",
    });
  });
});
