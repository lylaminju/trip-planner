import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { DESTINATIONS } from "@/data/destinations";
import {
  DESTINATION_OPTIONS,
  filterDestinationOptions,
  findDestinationOption,
} from "@/lib/destination-options";
import { DEFAULT_TRIP_COVER_IMAGE, getTripCoverImage } from "@/lib/city-covers";

describe("destination options", () => {
  it("provides a cover image for every curated destination", () => {
    expect(
      DESTINATION_OPTIONS.every(
        (option) => option.imagePath === `/city-covers/${option.slug}.webp`,
      ),
    ).toBe(true);
  });

  it("keeps destination cover files and attribution metadata in sync", async () => {
    const attributionText = await readFile(
      "public/city-covers/attributions.json",
      "utf8",
    );
    const attributions = JSON.parse(attributionText) as Array<{
      slug: string;
      file: string;
      downloadedFrom: string;
      attribution: {
        artist: string;
        licenseShortName: string;
        usageTerms: string;
      };
    }>;
    const attributionBySlug = new Map(
      attributions.map((attribution) => [attribution.slug, attribution]),
    );
    const destinationSlugs = DESTINATIONS.map(
      (destination) => destination.slug,
    );

    expect(attributions.map((attribution) => attribution.slug)).toEqual(
      destinationSlugs,
    );

    for (const slug of destinationSlugs) {
      const attribution = attributionBySlug.get(slug);

      expect(attribution?.file).toBe(`/city-covers/${slug}.webp`);
      expect(attribution?.downloadedFrom).toMatch(/^https?:\/\//);
      expect(attribution?.attribution.artist).toBeTruthy();
      expect(attribution?.attribution.licenseShortName).toBeTruthy();
      expect(attribution?.attribution.usageTerms).toBeTruthy();
      expect(
        existsSync(path.join("public", "city-covers", `${slug}.webp`)),
      ).toBe(true);
    }
  });

  it("returns dropdown options in alphabetical order", () => {
    const destinationNames = DESTINATIONS.map(
      (destination) => destination.name,
    );

    expect(filterDestinationOptions("").map((option) => option.name)).toEqual(
      [...destinationNames].sort((first, second) =>
        first.localeCompare(second),
      ),
    );
  });

  it("keeps the source destination list alphabetized by name", () => {
    const names = DESTINATIONS.map((destination) => destination.name);

    expect(names).toEqual(
      [...names].sort((first, second) => first.localeCompare(second)),
    );
  });

  it("keeps country codes on source and derived destination options", () => {
    expect(
      DESTINATIONS.every((destination) =>
        /^[A-Z]{2}$/.test(destination.countryCode),
      ),
    ).toBe(true);

    expect(
      DESTINATION_OPTIONS.find((option) => option.slug === "tokyo")
        ?.countryCode,
    ).toBe("JP");
  });

  it("derives cover image paths from destination slugs", () => {
    expect(
      DESTINATION_OPTIONS.find((option) => option.slug === "new-york-city")
        ?.imagePath,
    ).toBe("/city-covers/new-york-city.webp");
  });

  it("filters the curated destination list by canonical name or slug", () => {
    expect(
      filterDestinationOptions("toro").map((option) => option.name),
    ).toEqual(["Toronto"]);
    expect(
      filterDestinationOptions("new-york-city").map((option) => option.name),
    ).toEqual(["New York City"]);
    expect(
      filterDestinationOptions("tokyo japan").map((option) => option.name),
    ).toEqual([]);
  });

  it("finds curated destinations by canonical name or slug", () => {
    expect(findDestinationOption("Toronto")?.slug).toBe("toronto");
    expect(findDestinationOption("new-york-city")?.slug).toBe("new-york-city");
    expect(findDestinationOption("Victoria")?.slug).toBe("victoria");
    expect(findDestinationOption("toronto on")).toBeNull();
    expect(findDestinationOption("calgary alberta")).toBeNull();
    expect(findDestinationOption("Calgary + Banff")).toBeNull();
  });

  it("uses curated cover images only for exact destination matches", () => {
    expect(
      getTripCoverImage({
        destination: "Toronto",
      }),
    ).toBe("/city-covers/toronto.webp");

    expect(
      getTripCoverImage({
        destination: "Calgary + Banff",
      }),
    ).toBe(DEFAULT_TRIP_COVER_IMAGE);

    expect(
      getTripCoverImage({
        destination: "Seoul",
      }),
    ).toBe("/city-covers/seoul.webp");

    expect(findDestinationOption("London")?.slug).toBe("london");
    expect(
      getTripCoverImage({
        destination: "London",
      }),
    ).toBe("/city-covers/london.webp");
  });
});
