import { describe, expect, it } from "vitest";

import {
  createDayScheduleCursor,
  NO_DWELL_TIME,
} from "@/server/ai-plan-day-schedule";

describe("createDayScheduleCursor", () => {
  it("holds the next stop until the previous one has finished", () => {
    const cursor = createDayScheduleCursor();

    expect(cursor.place("09:20", 180)).toBe("09:20");
    expect(cursor.place("11:30", 60)).toBe("12:20");
  });

  it("leaves a stop that already clears the previous one untouched", () => {
    const cursor = createDayScheduleCursor();

    expect(cursor.place("09:20", 90)).toBe("09:20");
    expect(cursor.place("11:00", 60)).toBe("11:00");
  });

  it("still separates stops that share a start time", () => {
    const cursor = createDayScheduleCursor();

    expect(cursor.place("09:00", NO_DWELL_TIME)).toBe("09:00");
    expect(cursor.place("09:00", NO_DWELL_TIME)).toBe("09:10");
  });

  it("rounds a push up to the 10-minute grid", () => {
    const cursor = createDayScheduleCursor();

    expect(cursor.place("09:00", 95)).toBe("09:00");
    expect(cursor.place("10:00", 30)).toBe("10:40");
  });

  it("compounds pushes across a day of back-to-back overlaps", () => {
    const cursor = createDayScheduleCursor();

    expect(cursor.place("10:35", 45)).toBe("10:35");
    expect(cursor.place("10:45", 45)).toBe("11:20");
    expect(cursor.place("10:50", 60)).toBe("12:10");
  });

  it("passes an unparseable time through without moving the cursor", () => {
    const cursor = createDayScheduleCursor();

    expect(cursor.place("09:00", 60)).toBe("09:00");
    expect(cursor.place("not-a-time", 60)).toBe("not-a-time");
    expect(cursor.place("09:30", 60)).toBe("10:00");
  });
});
