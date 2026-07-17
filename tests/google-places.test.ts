import { describe, expect, it } from "vitest";

import { parseDetails, parseSuggestions } from "@/server/google-places";

describe("parseSuggestions", () => {
  it("maps place predictions to suggestions and drops incomplete rows", () => {
    const payload = {
      suggestions: [
        {
          placePrediction: {
            placeId: "abc",
            structuredFormat: {
              mainText: { text: "Kyoto" },
              secondaryText: { text: "Japan" },
            },
          },
        },
        // Missing placeId — must be skipped.
        {
          placePrediction: {
            structuredFormat: { mainText: { text: "Nowhere" } },
          },
        },
        // Missing main text — must be skipped.
        {
          placePrediction: {
            placeId: "def",
            structuredFormat: { secondaryText: { text: "Orphan" } },
          },
        },
      ],
    };

    expect(parseSuggestions(payload)).toEqual([
      { place_id: "abc", primary_text: "Kyoto", secondary_text: "Japan" },
    ]);
  });

  it("returns a suggestion with null secondary text when absent", () => {
    const payload = {
      suggestions: [
        {
          placePrediction: {
            placeId: "abc",
            structuredFormat: { mainText: { text: "Kyoto" } },
          },
        },
      ],
    };

    expect(parseSuggestions(payload)).toEqual([
      { place_id: "abc", primary_text: "Kyoto", secondary_text: null },
    ]);
  });

  it.each([null, undefined, {}, { suggestions: "nope" }, { suggestions: [{}] }])(
    "fails closed to an empty list for malformed payload %#",
    (payload) => {
      expect(parseSuggestions(payload)).toEqual([]);
    },
  );
});

describe("parseDetails", () => {
  it("maps a valid place detail response", () => {
    const payload = {
      id: "place-1",
      displayName: { text: "Kyoto" },
      location: { latitude: 35.01, longitude: 135.76 },
      googleMapsUri: "https://maps.google.com/?cid=1",
    };

    expect(parseDetails(payload)).toEqual({
      place_id: "place-1",
      name: "Kyoto",
      latitude: 35.01,
      longitude: 135.76,
      google_maps_url: "https://maps.google.com/?cid=1",
    });
  });

  it("returns null google_maps_url when the uri is missing", () => {
    const payload = {
      id: "place-1",
      displayName: { text: "Kyoto" },
      location: { latitude: 35.01, longitude: 135.76 },
    };

    expect(parseDetails(payload)?.google_maps_url).toBeNull();
  });

  it.each([
    null,
    undefined,
    {},
    { id: "x", displayName: { text: "Kyoto" } },
    {
      id: "x",
      displayName: { text: "Kyoto" },
      location: { latitude: "35", longitude: 135 },
    },
    { displayName: { text: "Kyoto" }, location: { latitude: 1, longitude: 2 } },
  ])("returns null for malformed detail payload %#", (payload) => {
    expect(parseDetails(payload)).toBeNull();
  });
});
