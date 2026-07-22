import { describe, expect, it } from "vitest";

import {
  googleImageCredit,
  imageResolutionAllowance,
} from "@/server/google-candidate-images";
import {
  PLACES_PER_USER_DAILY_LIMIT,
  PLACES_PHOTO_MONTHLY_LIMIT,
} from "@/server/supabase-google-places-usage-store";

describe("imageResolutionAllowance", () => {
  it("allows the full batch when budgets have room", () => {
    expect(
      imageResolutionAllowance({
        candidateCount: 40,
        photoCallsThisMonth: 0,
        userCallsToday: 0,
      }),
    ).toBe(40);
  });

  it("truncates to the remaining shared monthly photo budget", () => {
    expect(
      imageResolutionAllowance({
        candidateCount: 40,
        photoCallsThisMonth: PLACES_PHOTO_MONTHLY_LIMIT - 10,
        userCallsToday: 0,
      }),
    ).toBe(10);
  });

  it("truncates to the user's remaining daily budget", () => {
    expect(
      imageResolutionAllowance({
        candidateCount: 40,
        photoCallsThisMonth: 0,
        userCallsToday: PLACES_PER_USER_DAILY_LIMIT - 5,
      }),
    ).toBe(5);
  });

  it("returns zero once a budget is exhausted, never negative", () => {
    expect(
      imageResolutionAllowance({
        candidateCount: 40,
        photoCallsThisMonth: PLACES_PHOTO_MONTHLY_LIMIT + 3,
        userCallsToday: 0,
      }),
    ).toBe(0);
  });
});

describe("googleImageCredit", () => {
  it("credits the photo author with a Google Maps suffix", () => {
    expect(googleImageCredit("Jane Doe")).toBe("Jane Doe, via Google Maps");
    expect(googleImageCredit(null)).toBe("Google Maps");
  });
});
