import { describe, expect, it } from "vitest";

import {
  nameMatchScore,
  pickPlaceMatch,
  sharesDistinctiveToken,
  tokenizeName,
} from "../scripts/backfill-candidate-place-ids.mjs";

const REYNISFJARA = {
  name: "Reynisfjara Black Sand Beach",
  destination_slug: "iceland",
  latitude: 63.4063,
  longitude: -19.0708,
};

function placeResult(id, name, latitude, longitude) {
  return {
    id,
    displayName: { text: name },
    location: { latitude, longitude },
  };
}

describe("tokenizeName", () => {
  it("folds diacritics and Icelandic letters so curated ASCII names match", () => {
    expect(tokenizeName("Goðafoss")).toEqual(["godafoss"]);
    expect(tokenizeName("Jökulsárlón")).toEqual(["jokulsarlon"]);
    expect(tokenizeName("Kerið Crater")).toEqual(["kerid", "crater"]);
  });
});

describe("sharesDistinctiveToken", () => {
  it("rejects a result sharing only generic place words", () => {
    expect(
      sharesDistinctiveToken(
        "Reynisfjara Black Sand Beach",
        "Víkurfjara Black Sand Beach",
        "iceland",
      ),
    ).toBe(false);
  });

  it("accepts a result sharing the proper noun and ignores the destination's own name", () => {
    expect(
      sharesDistinctiveToken(
        "Reynisfjara Black Sand Beach",
        "Reynisfjara Beach",
        "iceland",
      ),
    ).toBe(true);
    expect(
      sharesDistinctiveToken(
        "Banff Gondola and Sulphur Mountain",
        "Banff Sunshine Village",
        "banff-national-park",
      ),
    ).toBe(false);
  });
});

describe("pickPlaceMatch", () => {
  it("prefers the proper-noun match over a closer generic-word imposter", () => {
    const match = pickPlaceMatch(
      {
        places: [
          placeResult("wrong-beach", "Víkurfjara Black Sand Beach", 63.4181, -19.0385),
          placeResult("right-beach", "Reynisfjara Beach", 63.4021, -19.0454),
        ],
      },
      REYNISFJARA,
    );

    expect(match?.placeId).toBe("right-beach");
  });

  it("rejects results beyond the distance cap and fails closed on malformed responses", () => {
    const farAway = pickPlaceMatch(
      { places: [placeResult("other-town", "Reynisfjara Beach", 64.9, -18.5)] },
      REYNISFJARA,
    );
    expect(farAway).toBeNull();

    expect(pickPlaceMatch({}, REYNISFJARA)).toBeNull();
    expect(
      pickPlaceMatch({ places: [{ id: "no-location" }] }, REYNISFJARA),
    ).toBeNull();
  });

  it("rejects results below the name-score floor", () => {
    expect(nameMatchScore("Myvatn Nature Baths", "Earth Lagoon Mývatn")).toBeCloseTo(1 / 3);
    const match = pickPlaceMatch(
      {
        places: [
          placeResult("weak", "Earth Lagoon Mývatn Iceland Tours", 63.4063, -19.0708),
        ],
      },
      { ...REYNISFJARA, name: "Myvatn" },
    );
    expect(match).toBeNull();
  });
});
