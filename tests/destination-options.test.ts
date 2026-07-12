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
import { isAiPlanningDestinationSupported } from "@/lib/ai-planning";

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

  it("lists AI-planning destinations first, then alphabetical within each group", () => {
    const options = filterDestinationOptions("");

    // Every curated destination appears exactly once.
    expect(options.map((option) => option.name).sort(byName)).toEqual(
      DESTINATIONS.map((destination) => destination.name).sort(byName),
    );

    // AI-supported destinations are grouped ahead of the unsupported ones.
    const supportedFlags = options.map((option) =>
      isAiPlanningDestinationSupported(option.slug),
    );
    const firstUnsupported = supportedFlags.indexOf(false);
    expect(supportedFlags.slice(0, firstUnsupported).every(Boolean)).toBe(true);
    expect(supportedFlags.slice(firstUnsupported).some(Boolean)).toBe(false);

    // Names stay alphabetical within each group.
    const supportedNames = options
      .filter((option) => isAiPlanningDestinationSupported(option.slug))
      .map((option) => option.name);
    const unsupportedNames = options
      .filter((option) => !isAiPlanningDestinationSupported(option.slug))
      .map((option) => option.name);
    expect(supportedNames).toEqual([...supportedNames].sort(byName));
    expect(unsupportedNames).toEqual([...unsupportedNames].sort(byName));
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
        destinationSlug: "toronto",
      }),
    ).toBe("/city-covers/toronto.webp");

    expect(
      getTripCoverImage({
        destination: "Calgary + Banff",
        destinationSlug: null,
      }),
    ).toBe(DEFAULT_TRIP_COVER_IMAGE);

    expect(
      getTripCoverImage({
        destination: "Seoul",
        destinationSlug: "seoul",
      }),
    ).toBe("/city-covers/seoul.webp");

    expect(findDestinationOption("London")?.slug).toBe("london");
    expect(
      getTripCoverImage({
        destination: "London",
        destinationSlug: "london",
      }),
    ).toBe("/city-covers/london.webp");
  });

  it("uses destination slugs instead of inferring covers from display text", () => {
    expect(
      getTripCoverImage({
        destination: "Custom Toronto label",
        destinationSlug: "toronto",
      }),
    ).toBe("/city-covers/toronto.webp");

    expect(
      getTripCoverImage({
        destination: "Toronto",
        destinationSlug: null,
      }),
    ).toBe(DEFAULT_TRIP_COVER_IMAGE);
  });
});

function byName(first: string, second: string): number {
  return first.localeCompare(second);
}
