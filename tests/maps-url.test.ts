import { describe, expect, it } from "vitest";
import { parseGoogleMapsUrl } from "@/lib/google-maps-url";
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsSearchUrl,
  buildResolvableGoogleMapsPlaceUrl,
} from "@/lib/maps-url";

describe("buildGoogleMapsSearchUrl", () => {
  it("builds a documented Maps URLs search link from coordinates", () => {
    const url = buildGoogleMapsSearchUrl({
      latitude: 40.7579747,
      longitude: -73.9855426,
    });

    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=40.7579747%2C-73.9855426",
    );
  });
});

describe("buildResolvableGoogleMapsPlaceUrl", () => {
  // A live search pick only yields a place id, so the field bakes the resolved
  // name and coordinates into a URL that must round-trip back through the same
  // parser the server uses to resolve the saved lodging/transit point.
  it("round-trips a picked place's name and coordinates through the resolver", () => {
    const url = buildResolvableGoogleMapsPlaceUrl({
      name: "Hotel Sacher",
      latitude: 48.2036,
      longitude: 16.3695,
    });

    const parsed = parseGoogleMapsUrl(url);
    expect(parsed.name).toBe("Hotel Sacher");
    expect(parsed.latitude).toBe(48.2036);
    expect(parsed.longitude).toBe(16.3695);
  });

  it("keeps names with commas from leaking into parsed coordinates", () => {
    const url = buildResolvableGoogleMapsPlaceUrl({
      name: "Nobu Hotel, Downtown",
      latitude: 34.0407,
      longitude: -118.2468,
    });

    const parsed = parseGoogleMapsUrl(url);
    expect(parsed.name).toBe("Nobu Hotel, Downtown");
    expect(parsed.latitude).toBe(34.0407);
    expect(parsed.longitude).toBe(-118.2468);
  });
});

describe("buildGoogleMapsDirectionsUrl", () => {
  it("uses coordinates and official Google travel mode names", () => {
    const url = buildGoogleMapsDirectionsUrl({
      origin: { latitude: 40.7579747, longitude: -73.9855426 },
      destination: { latitude: 40.7118042, longitude: -74.0118498 },
      mode: "transit",
    });

    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&origin=40.7579747%2C-73.9855426&destination=40.7118042%2C-74.0118498&travelmode=transit",
    );
  });
});
