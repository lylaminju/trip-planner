import { describe, expect, it } from "vitest";
import { buildGoogleMapsDirectionsUrl } from "@/lib/maps-url";

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
