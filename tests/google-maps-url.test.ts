import { describe, expect, it } from "vitest";
import { parseGoogleMapsUrl } from "@/lib/google-maps-url";

describe("parseGoogleMapsUrl", () => {
  it("parses canonical maps URLs on google.com", () => {
    expect(
      parseGoogleMapsUrl("https://google.com/maps/place/Oculus/@40.7118042,-74.0118498,17z"),
    ).toMatchObject({
      latitude: 40.7118042,
      longitude: -74.0118498,
      name: "Oculus",
    });
  });

  it("extracts coordinates from @lat,lng URLs", () => {
    expect(
      parseGoogleMapsUrl("https://www.google.com/maps/place/Oculus/@40.7118042,-74.0118498,17z"),
    ).toMatchObject({
      latitude: 40.7118042,
      longitude: -74.0118498,
      name: "Oculus",
    });
  });

  it("parses canonical maps URLs on maps.google.com", () => {
    expect(
      parseGoogleMapsUrl("https://maps.google.com/maps/place/Oculus/@40.7118042,-74.0118498,17z"),
    ).toMatchObject({
      latitude: 40.7118042,
      longitude: -74.0118498,
      name: "Oculus",
    });
  });

  it("parses canonical maps URLs on Google country domains", () => {
    expect(
      parseGoogleMapsUrl("https://www.google.ca/maps/place/Oculus/@40.7118042,-74.0118498,17z"),
    ).toMatchObject({
      latitude: 40.7118042,
      longitude: -74.0118498,
      name: "Oculus",
    });
  });

  it("parses canonical maps URLs on bare google.ca", () => {
    expect(
      parseGoogleMapsUrl("https://google.ca/maps/place/Oculus/@40.7118042,-74.0118498,17z"),
    ).toMatchObject({
      latitude: 40.7118042,
      longitude: -74.0118498,
      name: "Oculus",
    });
  });

  it("parses canonical maps URLs on maps.google.ca", () => {
    expect(
      parseGoogleMapsUrl("https://maps.google.ca/maps/place/Oculus/@40.7118042,-74.0118498,17z"),
    ).toMatchObject({
      latitude: 40.7118042,
      longitude: -74.0118498,
      name: "Oculus",
    });
  });

  it("extracts coordinates from !3dlat!4dlng URLs", () => {
    expect(
      parseGoogleMapsUrl("https://www.google.com/maps/place/Times+Square/data=!3d40.7579747!4d-73.9855426"),
    ).toMatchObject({
      latitude: 40.7579747,
      longitude: -73.9855426,
      name: "Times Square",
    });
  });

  it("prefers exact !3dlat!4dlng pin coordinates over viewport @lat,lng coordinates", () => {
    expect(
      parseGoogleMapsUrl(
        "https://www.google.com/maps/place/Trader+Joe's/@40.718093,-73.9680052,17z/data=!4m6!3m5!1s0x89c25977eae760c9:0xfb4f27c0aa127edb!8m2!3d40.7180932!4d-73.9643128!16s%2Fg%2F11s19pcwkd",
      ),
    ).toMatchObject({
      latitude: 40.7180932,
      longitude: -73.9643128,
      name: "Trader Joe's",
    });
  });

  it("decodes percent-encoded place names", () => {
    expect(
      parseGoogleMapsUrl("https://www.google.com/maps/place/S%C3%A3o+Paulo/@-23.55052,-46.633308,12z"),
    ).toMatchObject({
      latitude: -23.55052,
      longitude: -46.633308,
      name: "São Paulo",
    });
  });

  it("returns null coordinates for malformed @lat,lng token suffixes", () => {
    expect(
      parseGoogleMapsUrl("https://www.google.com/maps/place/Oculus/@40.7118042,-74.0118498abc"),
    ).toEqual({
      name: "Oculus",
      latitude: null,
      longitude: null,
    });
  });

  it("does not parse coordinates from a non-Maps wrapper URL query string", () => {
    expect(
      parseGoogleMapsUrl(
        "https://example.com/redirect?next=https%3A%2F%2Fwww.google.com%2Fmaps%2Fplace%2FOculus%2F%4040.7118042%2C-74.0118498%2C17z",
      ),
    ).toEqual({
      name: null,
      latitude: null,
      longitude: null,
    });
  });

  it("does not parse coordinates or names from a non-Google wrapper URL path", () => {
    expect(
      parseGoogleMapsUrl(
        "https://example.com/https%3A%2F%2Fwww.google.com%2Fmaps%2Fplace%2FOculus%2F%4040.7118042%2C-74.0118498%2C17z",
      ),
    ).toEqual({
      name: null,
      latitude: null,
      longitude: null,
    });
  });

  it("does not parse coordinates or names from a non-Google wrapper URL hash", () => {
    expect(
      parseGoogleMapsUrl(
        "https://example.com/#https%3A%2F%2Fwww.google.com%2Fmaps%2Fplace%2FOculus%2F%4040.7118042%2C-74.0118498%2C17z",
      ),
    ).toEqual({
      name: null,
      latitude: null,
      longitude: null,
    });
  });

  it("rejects bare google.foo.bar hosts", () => {
    expect(
      parseGoogleMapsUrl("https://google.foo.bar/maps/place/Oculus/@40.7118042,-74.0118498,17z"),
    ).toEqual({
      name: null,
      latitude: null,
      longitude: null,
    });
  });

  it("rejects www.google.foo.bar hosts", () => {
    expect(
      parseGoogleMapsUrl("https://www.google.foo.bar/maps/place/Oculus/@40.7118042,-74.0118498,17z"),
    ).toEqual({
      name: null,
      latitude: null,
      longitude: null,
    });
  });

  it("rejects maps.google.foo.bar hosts", () => {
    expect(
      parseGoogleMapsUrl("https://maps.google.foo.bar/maps/place/Oculus/@40.7118042,-74.0118498,17z"),
    ).toEqual({
      name: null,
      latitude: null,
      longitude: null,
    });
  });

  it("returns null coordinates when the URL has no parseable location", () => {
    expect(parseGoogleMapsUrl("https://maps.app.goo.gl/abc123")).toEqual({
      name: null,
      latitude: null,
      longitude: null,
    });
  });
});
