import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchDestinationSuggestions,
  fetchPlacePhotoReference,
  parseDetails,
  parsePhotoReference,
  parseSuggestions,
} from "@/server/google-places";

describe("fetchDestinationSuggestions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch() {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ suggestions: [] }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("sends a circle location bias when one is provided", async () => {
    const fetchMock = stubFetch();

    await fetchDestinationSuggestions({
      apiKey: "key",
      query: "louvre",
      sessionToken: "session-1",
      locationBias: { latitude: 48.8566, longitude: 2.3522 },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.locationBias).toEqual({
      circle: {
        center: { latitude: 48.8566, longitude: 2.3522 },
        radius: 50_000,
      },
    });
  });

  it("omits the location bias when none is provided", async () => {
    const fetchMock = stubFetch();

    await fetchDestinationSuggestions({
      apiKey: "key",
      query: "louvre",
      sessionToken: "session-1",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).not.toHaveProperty("locationBias");
  });

  it("restricts to the given country codes, lowercased", async () => {
    const fetchMock = stubFetch();

    await fetchDestinationSuggestions({
      apiKey: "key",
      query: "ferry terminal",
      sessionToken: "session-1",
      countryCodes: ["JP", "KR"],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.includedRegionCodes).toEqual(["jp", "kr"]);
  });

  it.each([undefined, null, []])(
    "omits the country restriction when none is provided %#",
    async (countryCodes) => {
      const fetchMock = stubFetch();

      await fetchDestinationSuggestions({
        apiKey: "key",
        query: "ferry terminal",
        sessionToken: "session-1",
        countryCodes,
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body).not.toHaveProperty("includedRegionCodes");
    },
  );

  it("caps the country codes at the API maximum of 15", async () => {
    const fetchMock = stubFetch();
    const countryCodes = Array.from({ length: 20 }, () => "jp");

    await fetchDestinationSuggestions({
      apiKey: "key",
      query: "ferry terminal",
      sessionToken: "session-1",
      countryCodes,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.includedRegionCodes).toHaveLength(15);
  });
});

describe("fetchPlacePhotoReference", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The reference lookup must stay inside the free IDs-Only tier: any extra
  // field in the mask would silently escalate it into a billed details SKU.
  it("requests only free IDs-Only fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchPlacePhotoReference({ apiKey: "key", placeId: "ChIJabc" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/places/ChIJabc");
    expect(init.headers["X-Goog-FieldMask"]).toBe("id,photos");
  });
});

describe("parsePhotoReference", () => {
  it("extracts the first photo name and its attribution", () => {
    expect(
      parsePhotoReference({
        photos: [
          {
            name: "places/ChIJabc/photos/ref-1",
            authorAttributions: [{ displayName: "Jane Doe" }],
          },
          { name: "places/ChIJabc/photos/ref-2" },
        ],
      }),
    ).toEqual({
      photo_name: "places/ChIJabc/photos/ref-1",
      photo_attribution: "Jane Doe",
    });
  });

  it.each([{}, { photos: [] }, { photos: [{ authorAttributions: [] }] }])(
    "returns nulls when no usable photo exists %#",
    (payload) => {
      expect(parsePhotoReference(payload)).toEqual({
        photo_name: null,
        photo_attribution: null,
      });
    },
  );
});

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
      country_code: null,
      photo_name: null,
      photo_attribution: null,
    });
  });

  it("extracts the country code from the country address component", () => {
    const payload = {
      id: "place-1",
      displayName: { text: "Yakushima" },
      location: { latitude: 30.34, longitude: 130.51 },
      addressComponents: [
        { types: ["locality", "political"], shortText: "Yakushima" },
        { types: ["country", "political"], shortText: "JP", longText: "Japan" },
      ],
    };

    expect(parseDetails(payload)?.country_code).toBe("JP");
  });

  it.each([
    undefined,
    [],
    [{ types: ["locality"], shortText: "Yakushima" }],
    [{ types: ["country"] }],
  ])("returns a null country code when none is present %#", (addressComponents) => {
    const payload = {
      id: "place-1",
      displayName: { text: "Kyoto" },
      location: { latitude: 35.01, longitude: 135.76 },
      addressComponents,
    };

    expect(parseDetails(payload)?.country_code).toBeNull();
  });

  it("extracts the first photo reference and its author attribution", () => {
    const payload = {
      id: "place-1",
      displayName: { text: "Kyoto" },
      location: { latitude: 35.01, longitude: 135.76 },
      photos: [
        {
          name: "places/place-1/photos/ref-1",
          authorAttributions: [{ displayName: "Jane Doe" }],
        },
        { name: "places/place-1/photos/ref-2" },
      ],
    };

    expect(parseDetails(payload)).toMatchObject({
      photo_name: "places/place-1/photos/ref-1",
      photo_attribution: "Jane Doe",
    });
  });

  it("keeps the photo reference but nulls attribution when none is given", () => {
    const payload = {
      id: "place-1",
      displayName: { text: "Kyoto" },
      location: { latitude: 35.01, longitude: 135.76 },
      photos: [{ name: "places/place-1/photos/ref-1" }],
    };

    const details = parseDetails(payload);
    expect(details?.photo_name).toBe("places/place-1/photos/ref-1");
    expect(details?.photo_attribution).toBeNull();
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
