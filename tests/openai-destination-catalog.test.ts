import { describe, expect, it, vi } from "vitest";

import { destinationCandidateKey } from "@/lib/ai-planning";
import {
  AI_CATALOG_MIN_CANDIDATE_COUNT,
  requestAiDestinationCatalog,
  requestAiDestinationTransitHubs,
  sanitizeAiDestinationCandidates,
  sanitizeAiDestinationTransitHubs,
  type AiDestinationCatalog,
  type AiDestinationTransitHubList,
} from "@/server/openai-destination-catalog";

const LISBON = { latitude: 38.7223, longitude: -9.1393 };
const LISBON_DESTINATION = {
  name: "Lisbon",
  latitude: LISBON.latitude,
  longitude: LISBON.longitude,
  countryNames: ["Portugal"],
};

describe("requestAiDestinationCatalog", () => {
  it("requests a strict structured attraction catalog from model knowledge alone", async () => {
    const catalog = { candidates: [] };
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        output_text: JSON.stringify(catalog),
        usage: { input_tokens: 11, output_tokens: 22 },
      }),
    );

    await expect(
      requestAiDestinationCatalog({
        apiKey: "test-key",
        model: "gpt-5.5",
        destination: LISBON_DESTINATION,
        fetchImpl: fetchMock,
      }),
    ).resolves.toEqual({
      catalog,
      usage: { inputTokens: 11, outputTokens: 22 },
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
    // No web search: catalog speed comes first; date-specific verification
    // happens at itinerary generation instead.
    expect(body.tools).toBeUndefined();
    expect(body.max_tool_calls).toBeUndefined();
    expect(body.input[0].content[0].text).toContain("most iconic first");
    expect(body.input[0].content[0].text).toContain(
      "permanently closed or under long-term renovation",
    );
    expect(JSON.parse(body.input[1].content[0].text).destination.name).toBe(
      "Lisbon",
    );
    expect(body.text.format.type).toBe("json_schema");
    expect(body.text.format.strict).toBe(true);
    expect(
      body.text.format.schema.properties.candidates.items.properties.tags.items
        .enum,
    ).toContain("landmarks");
    // Hubs come from their own faster call, not this one.
    expect(body.text.format.schema.properties.transit_hubs).toBeUndefined();
  });

  it("normalizes failed OpenAI responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ error: { message: "Bad request" } }, { status: 400 }),
    );

    await expect(
      requestAiDestinationCatalog({
        apiKey: "test-key",
        model: "gpt-5.5",
        destination: LISBON_DESTINATION,
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(
      "OpenAI destination catalog generation failed: Bad request",
    );
  });

  it("reports non-JSON OpenAI responses instead of raising a parse error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("<!DOCTYPE html>", { status: 502 }));

    await expect(
      requestAiDestinationCatalog({
        apiKey: "test-key",
        model: "gpt-5.5",
        destination: LISBON_DESTINATION,
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(
      "OpenAI destination catalog generation failed: HTTP 502 with a non-JSON response",
    );
  });

  it("maps OpenAI 429 responses to a friendly rate-limit error that keeps the upstream detail", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        { error: { message: "Rate limit reached on tokens per min (TPM)" } },
        { status: 429 },
      ),
    );

    const request = requestAiDestinationCatalog({
      apiKey: "test-key",
      model: "gpt-5.5",
      destination: LISBON_DESTINATION,
      fetchImpl: fetchMock,
    });

    await expect(request).rejects.toThrow(
      "The AI service is handling too many requests right now. Please try again in a minute.",
    );
    await expect(request).rejects.toMatchObject({
      upstreamDetail: "Rate limit reached on tokens per min (TPM)",
    });
  });
});

describe("requestAiDestinationTransitHubs", () => {
  it("requests a strict structured hub list without web search", async () => {
    const hubList = { transit_hubs: [] };
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        output_text: JSON.stringify(hubList),
        usage: { input_tokens: 5, output_tokens: 7 },
      }),
    );

    await expect(
      requestAiDestinationTransitHubs({
        apiKey: "test-key",
        model: "gpt-5.5",
        destination: LISBON_DESTINATION,
        fetchImpl: fetchMock,
      }),
    ).resolves.toEqual({
      hubList,
      usage: { inputTokens: 5, outputTokens: 7 },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // Hubs are stable facts; the call stays cheap and fast without web search.
    expect(body.tools).toBeUndefined();
    expect(JSON.parse(body.input[1].content[0].text).destination.name).toBe(
      "Lisbon",
    );
    expect(body.text.format.strict).toBe(true);
    expect(
      body.text.format.schema.properties.transit_hubs.items.properties.hub_type
        .enum,
    ).toContain("airport");
  });

  it("normalizes failed OpenAI responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 500 }));

    await expect(
      requestAiDestinationTransitHubs({
        apiKey: "test-key",
        model: "gpt-5.5",
        destination: LISBON_DESTINATION,
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(
      "OpenAI transit hub generation failed: HTTP 500 with a non-JSON response",
    );
  });
});

describe("sanitizeAiDestinationCandidates", () => {
  it("drops duplicate names, unknown tags, and far-away coordinates, then renumbers", () => {
    const catalog: AiDestinationCatalog = {
      candidates: [
        ...generatedCandidates(AI_CATALOG_MIN_CANDIDATE_COUNT),
        candidateInput({ name: " Generated Spot 1 " }),
        candidateInput({
          name: "Mismatched Tags",
          tags: ["landmarks", "casinos", "landmarks"],
        }),
        candidateInput({ name: "Wrong Continent", latitude: 40.71, longitude: -74 }),
        candidateInput({ name: "Zero Duration", typical_duration_minutes: 0 }),
        candidateInput({ name: "  " }),
      ],
    };

    const candidates = sanitizeAiDestinationCandidates(catalog, LISBON);

    const names = candidates.map((candidate) => candidate.name);
    expect(names).not.toContain("Wrong Continent");
    expect(names).not.toContain("Zero Duration");
    expect(names.filter((name) => name === "Generated Spot 1")).toHaveLength(1);
    expect(
      candidates.find((candidate) => candidate.name === "Mismatched Tags")?.tags,
    ).toEqual(["landmarks"]);
    expect(candidates.map((candidate) => candidate.sort_order)).toEqual(
      candidates.map((_, index) => index + 1),
    );
  });

  it("drops hedged candidates whose name ends in a question mark", () => {
    const candidates = sanitizeAiDestinationCandidates(
      {
        candidates: [
          ...generatedCandidates(AI_CATALOG_MIN_CANDIDATE_COUNT),
          candidateInput({
            name: "Walt Disney Family Museum?",
            blurb: "skip...",
          }),
        ],
      },
      LISBON,
    );

    expect(
      candidates.some((candidate) => candidate.name.endsWith("?")),
    ).toBe(false);
    expect(candidates).toHaveLength(AI_CATALOG_MIN_CANDIDATE_COUNT);
  });

  it("keeps day-trip candidates within the allowed radius", () => {
    const sintra = candidateInput({
      name: "Pena Palace",
      latitude: 38.7876,
      longitude: -9.3904,
      region_distance_tier: "day_trip",
    });
    const candidates = sanitizeAiDestinationCandidates(
      {
        candidates: [
          ...generatedCandidates(AI_CATALOG_MIN_CANDIDATE_COUNT),
          sintra,
        ],
      },
      LISBON,
    );

    expect(
      candidates.some((candidate) => candidate.name === "Pena Palace"),
    ).toBe(true);
  });

  it("skips the distance check when the destination has no coordinates", () => {
    const candidates = sanitizeAiDestinationCandidates(
      { candidates: generatedCandidates(AI_CATALOG_MIN_CANDIDATE_COUNT) },
      { latitude: null, longitude: null },
    );

    expect(candidates).toHaveLength(AI_CATALOG_MIN_CANDIDATE_COUNT);
  });

  it("rejects catalogs with too few usable candidates", () => {
    expect(() =>
      sanitizeAiDestinationCandidates(
        { candidates: generatedCandidates(AI_CATALOG_MIN_CANDIDATE_COUNT - 1) },
        LISBON,
      ),
    ).toThrow("usable candidates");
  });
});

describe("sanitizeAiDestinationTransitHubs", () => {
  it("dedupes, trims, drops far-away hubs, and allows an empty result", () => {
    const hubList: AiDestinationTransitHubList = {
      transit_hubs: [
        hubInput({ name: "Lisbon Airport", iata_code: " LIS " }),
        hubInput({ name: "Lisbon Airport" }),
        hubInput({ name: "Far Ferry", latitude: 4.7, longitude: -74.1 }),
      ],
    };

    const hubs = sanitizeAiDestinationTransitHubs(hubList, LISBON);

    expect(hubs).toHaveLength(1);
    expect(hubs[0]).toMatchObject({
      name: "Lisbon Airport",
      iata_code: "LIS",
      sort_order: 1,
    });

    expect(
      sanitizeAiDestinationTransitHubs({ transit_hubs: [] }, LISBON),
    ).toEqual([]);
  });
});

describe("destinationCandidateKey", () => {
  const baseTrip = {
    destination: "Lisbon",
    destination_slug: null,
    destination_country_codes: ["PT"],
    destination_latitude: 38.7223,
    destination_longitude: -9.1393,
  };

  it("uses the curated slug when present", () => {
    expect(
      destinationCandidateKey({ ...baseTrip, destination_slug: "seoul" }),
    ).toBe("seoul");
  });

  it("derives a stable key from name and rounded coordinates", () => {
    expect(destinationCandidateKey(baseTrip)).toBe("custom-lisbon-38.7,-9.1");
  });

  // The country code used to be part of the key, so the same destination
  // landed in a different catalog depending on whether Google had resolved
  // country codes for the trip yet.
  it("keys the same destination identically whether or not country codes are set", () => {
    expect(
      destinationCandidateKey({ ...baseTrip, destination_country_codes: null }),
    ).toBe(destinationCandidateKey(baseTrip));
  });

  it("falls back to coordinates when the name has no Latin characters", () => {
    expect(
      destinationCandidateKey({
        ...baseTrip,
        destination: "서울",
        destination_country_codes: ["KR"],
        destination_latitude: 37.5503,
        destination_longitude: 126.9971,
      }),
    ).toBe("custom-place-37.6,127.0");
  });

  // Without coordinates there is no stable identity, and inventing a
  // placeholder segment would split one destination across several catalogs.
  it("returns null when the destination has no coordinates", () => {
    expect(
      destinationCandidateKey({
        ...baseTrip,
        destination: "Halifax",
        destination_latitude: null,
        destination_longitude: null,
      }),
    ).toBeNull();
  });
});

function candidateInput(
  overrides: Partial<AiDestinationCatalog["candidates"][number]> = {},
): AiDestinationCatalog["candidates"][number] {
  return {
    name: "Generated Spot",
    category: "landmark",
    tags: ["landmarks"],
    area: "Alfama",
    region_distance_tier: "central",
    latitude: 38.71,
    longitude: -9.13,
    typical_duration_minutes: 60,
    indoor_outdoor: null,
    planning_note: null,
    blurb: null,
    ...overrides,
  };
}

function generatedCandidates(
  count: number,
): AiDestinationCatalog["candidates"] {
  return Array.from({ length: count }, (_, index) =>
    candidateInput({ name: `Generated Spot ${index + 1}` }),
  );
}

function hubInput(
  overrides: Partial<
    AiDestinationTransitHubList["transit_hubs"][number]
  > = {},
): AiDestinationTransitHubList["transit_hubs"][number] {
  return {
    name: "Lisbon Airport",
    hub_type: "airport",
    iata_code: null,
    latitude: 38.7742,
    longitude: -9.1342,
    ...overrides,
  };
}
