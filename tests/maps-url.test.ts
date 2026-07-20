import { describe, expect, it } from "vitest";
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsSearchUrl,
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
