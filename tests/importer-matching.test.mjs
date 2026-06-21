import { describe, expect, it } from "vitest";

import { findExistingPlace } from "../scripts/import-google-list.mjs";

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
