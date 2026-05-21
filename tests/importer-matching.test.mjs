import { describe, expect, it } from "vitest";

function findExistingPlace(imported, existingRows) {
  if (imported.placeId) {
    const match = existingRows.find((row) => row.place_id === imported.placeId);
    if (match) return match;
  }

  if (imported.googlePlaceToken) {
    const match = existingRows.find(
      (row) => row.google_place_token === imported.googlePlaceToken,
    );
    if (match) return match;
  }

  if (imported.googleInternalIds) {
    const match = existingRows.find(
      (row) => row.google_internal_ids === imported.googleInternalIds,
    );
    if (match) return match;
  }

  return null;
}

describe("importer matching contract", () => {
  it("matches by place_id before weaker identities", () => {
    const placeIdMatch = {
      id: 1,
      place_id: "pid-1",
      google_place_token: "token-a",
      google_internal_ids: '["a"]',
    };
    const tokenMatch = {
      id: 2,
      place_id: null,
      google_place_token: "token-a",
      google_internal_ids: '["a"]',
    };

    expect(
      findExistingPlace(
        {
          placeId: "pid-1",
          googlePlaceToken: "token-a",
          googleInternalIds: '["a"]',
        },
        [tokenMatch, placeIdMatch],
      ),
    ).toBe(placeIdMatch);
  });

  it("matches by google_place_token before google_internal_ids", () => {
    const tokenMatch = {
      id: 2,
      place_id: null,
      google_place_token: "token-a",
      google_internal_ids: '["a"]',
    };
    const internalIdMatch = {
      id: 3,
      place_id: null,
      google_place_token: null,
      google_internal_ids: '["a"]',
    };

    expect(
      findExistingPlace(
        {
          placeId: null,
          googlePlaceToken: "token-a",
          googleInternalIds: '["a"]',
        },
        [internalIdMatch, tokenMatch],
      ),
    ).toBe(tokenMatch);
  });

  it("does not match rows without a stable identity", () => {
    expect(
      findExistingPlace(
        { placeId: null, googlePlaceToken: null, googleInternalIds: null },
        [],
      ),
    ).toBeNull();
  });
});
