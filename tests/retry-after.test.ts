import { describe, expect, it } from "vitest";

import {
  humanizeRetryAfter,
  parseRetryAfterSeconds,
} from "@/server/retry-after";

describe("parseRetryAfterSeconds", () => {
  it("prefers a numeric Retry-After header over the message", () => {
    expect(parseRetryAfterSeconds("120", "try again in 5s")).toBe(120);
  });

  it("rounds fractional header seconds up", () => {
    expect(parseRetryAfterSeconds("1.2", "")).toBe(2);
  });

  it("ignores non-numeric (HTTP-date) headers and falls back to the message", () => {
    expect(
      parseRetryAfterSeconds(
        "Wed, 21 Oct 2026 07:28:00 GMT",
        "Please try again in 30s.",
      ),
    ).toBe(30);
  });

  const messageCases: Array<[string, number | null]> = [
    ["Rate limit reached. Please try again in 51h56m26.88s. Visit ...", 186_987],
    ["Please try again in 2m3s.", 123],
    ["Please try again in 600ms.", 1],
    ["Please try again in 45s", 45],
    ["Rate limit reached on tokens per min (TPM)", null],
    ["", null],
  ];

  it.each(messageCases)(
    "parses the retry delay from %j",
    (message, expected) => {
      expect(parseRetryAfterSeconds(null, message)).toBe(expected);
    },
  );

  it("does not treat unrelated numbers (limits, token counts) as a delay", () => {
    expect(
      parseRetryAfterSeconds(
        null,
        "Limit 100000, Used 100000, Requested 7214.",
      ),
    ).toBeNull();
  });
});

describe("humanizeRetryAfter", () => {
  const cases: Array<[number | null, string]> = [
    [null, "a minute"],
    [0, "a minute"],
    [-5, "a minute"],
    [1, "less than a minute"],
    [59, "less than a minute"],
    [60, "about 1 minute"],
    [61, "about 2 minutes"],
    [3600, "about 1 hour"],
    [7200, "about 2 hours"],
    [86_400, "about 24 hours"],
    [186_987, "about 52 hours"],
  ];

  it.each(cases)("humanizes %j as %j", (seconds, expected) => {
    expect(humanizeRetryAfter(seconds)).toBe(expected);
  });
});
