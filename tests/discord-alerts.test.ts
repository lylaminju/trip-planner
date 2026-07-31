import { afterEach, describe, expect, it, vi } from "vitest";

import { ALERT_SEVERITY, buildAlertEvent } from "@/server/alert-events";
import {
  buildDiscordAlertPayload,
  postDiscordAlert,
} from "@/server/discord-alerts";
import {
  AiUpstreamRateLimitError,
  GoogleRoutesConfigError,
  GoogleRoutesRateLimitError,
} from "@/server/errors";

const OCCURRED_AT = new Date("2026-07-30T12:00:00.000Z");
const WEBHOOK_URL = "https://discord.com/api/webhooks/test";

// Discord rejects the entire call when a field overflows, so alerts built from
// a huge upstream body must stay inside the documented ceilings.
const DISCORD_DESCRIPTION_LIMIT = 4096;
const DISCORD_FIELD_VALUE_LIMIT = 1024;

function bugPayload(suppressedCount = 0) {
  return buildDiscordAlertPayload(
    buildAlertEvent({
      error: new GoogleRoutesConfigError("Routes API key missing"),
      severity: ALERT_SEVERITY.BUG,
      route: "/api/trips/1/route-segments/2/geometry",
      method: "GET",
    }),
    suppressedCount,
    OCCURRED_AT,
  );
}

describe("buildDiscordAlertPayload", () => {
  it("distinguishes defects from limits by color", () => {
    const limit = buildDiscordAlertPayload(
      buildAlertEvent({
        error: new GoogleRoutesRateLimitError("daily cap"),
        severity: ALERT_SEVERITY.LIMIT,
      }),
      0,
      OCCURRED_AT,
    );

    expect(bugPayload().embeds[0].color).not.toBe(limit.embeds[0].color);
  });

  it("names the error and includes the route it failed on", () => {
    const [embed] = bugPayload().embeds;

    expect(embed.title).toContain("GoogleRoutesConfigError");
    expect(embed.description).toBe("Routes API key missing");
    expect(embed.fields).toContainEqual(
      expect.objectContaining({
        name: "Route",
        value: "GET /api/trips/1/route-segments/2/geometry",
      }),
    );
  });

  it("reports swallowed repeats only when there were some", () => {
    const withRepeats = bugPayload(12).embeds[0].fields;
    const withoutRepeats = bugPayload(0).embeds[0].fields;

    expect(withRepeats).toContainEqual(
      expect.objectContaining({
        name: "Repeats",
        value: "12 more since the last alert",
      }),
    );
    expect(withoutRepeats.map((field) => field.name)).not.toContain("Repeats");
  });

  it("keeps oversized messages and details inside Discord's limits", () => {
    const [embed] = buildDiscordAlertPayload(
      buildAlertEvent({
        error: new AiUpstreamRateLimitError("d".repeat(5000), 30),
        severity: ALERT_SEVERITY.LIMIT,
      }),
      0,
      OCCURRED_AT,
    ).embeds;

    expect(embed.description.length).toBeLessThanOrEqual(
      DISCORD_DESCRIPTION_LIMIT,
    );
    for (const field of embed.fields) {
      expect(field.value.length).toBeLessThanOrEqual(DISCORD_FIELD_VALUE_LIMIT);
    }
  });
});

describe("postDiscordAlert", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts the payload as JSON to the webhook", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await postDiscordAlert(WEBHOOK_URL, bugPayload());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(WEBHOOK_URL);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).embeds[0].title).toContain(
      "GoogleRoutesConfigError",
    );
  });

  // Alerting is diagnostic plumbing. If it threw, it would mask the very error
  // it was reporting and turn a handled 503 into an unhandled 500.
  it("never throws when the webhook fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    await expect(
      postDiscordAlert(WEBHOOK_URL, bugPayload()),
    ).resolves.toBeUndefined();
  });

  it("never throws when the webhook rejects the payload", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 400 })),
    );

    await expect(
      postDiscordAlert(WEBHOOK_URL, bugPayload()),
    ).resolves.toBeUndefined();
  });
});
