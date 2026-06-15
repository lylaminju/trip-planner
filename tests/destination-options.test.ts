import { describe, expect, it } from "vitest";

import {
  filterDestinationOptions,
  findDestinationOption,
} from "@/lib/destination-options";
import { DEFAULT_TRIP_COVER_IMAGE, getTripCoverImage } from "@/lib/city-covers";

describe("destination options", () => {
  it("returns dropdown options in alphabetical order", () => {
    expect(filterDestinationOptions("").map((option) => option.name)).toEqual([
      "Banff National Park",
      "Los Angeles",
      "New York City",
      "San Francisco",
      "Toronto",
    ]);
  });

  it("filters the curated destination list by name and alias", () => {
    expect(
      filterDestinationOptions("tor").map((option) => option.name),
    ).toEqual(["Toronto"]);
    expect(
      filterDestinationOptions("nyc").map((option) => option.name),
    ).toEqual(["New York City"]);
  });

  it("finds curated destinations by canonical name or exact alias", () => {
    expect(findDestinationOption("Toronto")?.slug).toBe("toronto");
    expect(findDestinationOption("toronto on")?.slug).toBe("toronto");
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
  });
});
