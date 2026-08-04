import { describe, expect, it } from "vitest";
import { parseGoogleMapsUrl } from "@/lib/google-maps-url";
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsPlaceLinkUrl,
  buildResolvableGoogleMapsPlaceUrl,
} from "@/lib/maps-url";

describe("buildGoogleMapsPlaceLinkUrl", () => {
  it("opens the exact place when a Google place id is known", () => {
    const url = buildGoogleMapsPlaceLinkUrl({
      name: "Mulberry Coffeehouse",
      address: "James Street North",
      googlePlaceId: "ChIJcXvo5IabLIgRV9B03H_l-Bs",
    });

    expect(url).toBe(
      "https://www.google.com/maps/place/?q=place_id%3AChIJcXvo5IabLIgRV9B03H_l-Bs",
    );
  });

  // A coordinate query only drops an unnamed pin, so an id-less place has to
  // search by the text a person would type.
  it("searches by name and address when no place id is known", () => {
    const url = buildGoogleMapsPlaceLinkUrl({
      name: "Mulberry Coffeehouse",
      address: "James Street North",
      googlePlaceId: null,
    });

    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=Mulberry+Coffeehouse%2C+James+Street+North",
    );
  });

  it("searches by name alone when no address is known", () => {
    const url = buildGoogleMapsPlaceLinkUrl({
      name: "Hamilton GO Centre",
      googlePlaceId: null,
    });

    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=Hamilton+GO+Centre",
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
