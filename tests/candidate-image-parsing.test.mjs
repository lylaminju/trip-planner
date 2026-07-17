import { describe, expect, it } from "vitest";

import {
  buildBlurb,
  buildSearchQuery,
  extractImageCredit,
  extractPageSummary,
  pickMatchingSearchTitle,
  slugToPlaceName,
  stripHtml,
  stripPronunciationGlosses,
  titleMatchesCandidate,
} from "../scripts/backfill-candidate-images.mjs";

describe("Wikimedia response parsing", () => {
  it("extracts image url, file name, and intro from a page summary", () => {
    const summary = extractPageSummary({
      query: {
        pages: {
          123: {
            title: "Gullfoss",
            pageimage: "Gullfoss.jpg",
            original: { source: "https://upload.wikimedia.org/Gullfoss.jpg" },
            extract: "Gullfoss is a waterfall in southwest Iceland.",
          },
        },
      },
    });

    expect(summary).toEqual({
      title: "Gullfoss",
      imageUrl: "https://upload.wikimedia.org/Gullfoss.jpg",
      imageFileName: "Gullfoss.jpg",
      extract: "Gullfoss is a waterfall in southwest Iceland.",
    });
  });

  it("returns null for missing pages and malformed payloads", () => {
    expect(
      extractPageSummary({ query: { pages: { "-1": { missing: "" } } } }),
    ).toBeNull();
    expect(extractPageSummary(null)).toBeNull();
    expect(extractPageSummary({})).toBeNull();
    expect(extractPageSummary({ query: { pages: "nope" } })).toBeNull();
  });

  it("degrades to null image url when the page has no original image", () => {
    const summary = extractPageSummary({
      query: { pages: { 1: { title: "Somewhere", extract: "text" } } },
    });
    expect(summary?.imageUrl).toBeNull();
    expect(summary?.imageFileName).toBeNull();
  });

  it("builds a credit line from artist and license, stripping HTML", () => {
    const credit = extractImageCredit({
      query: {
        pages: {
          1: {
            imageinfo: [
              {
                extmetadata: {
                  Artist: { value: '<a href="/wiki/User:Jon">Jon &amp; Co</a>' },
                  LicenseShortName: { value: "CC BY-SA 4.0" },
                },
              },
            ],
          },
        },
      },
    });
    expect(credit).toBe("Jon & Co (CC BY-SA 4.0), via Wikimedia Commons");
  });

  it("falls back to a generic credit when the artist is absent", () => {
    const credit = extractImageCredit({
      query: {
        pages: {
          1: { imageinfo: [{ extmetadata: { LicenseShortName: { value: "CC0" } } }] },
        },
      },
    });
    expect(credit).toBe("Wikimedia Commons (CC0), via Wikimedia Commons");
  });

  it("returns null credit when extmetadata is missing", () => {
    expect(extractImageCredit({ query: { pages: { 1: {} } } })).toBeNull();
    expect(extractImageCredit(null)).toBeNull();
  });

  it("picks the first search result that plausibly names the candidate", () => {
    // Skips an unrelated higher-ranked hit and takes the matching one below it.
    expect(
      pickMatchingSearchTitle(
        {
          query: {
            search: [{ title: "Banff Sunshine Village" }, { title: "Mount Norquay" }],
          },
        },
        "Mount Norquay Lookout",
      ),
    ).toBe("Mount Norquay");
    // No result matches: fail closed rather than grab the top hit.
    expect(
      pickMatchingSearchTitle(
        { query: { search: [{ title: "Dragon Fli Empire" }] } },
        "Banff Avenue",
      ),
    ).toBeNull();
    expect(pickMatchingSearchTitle({ query: { search: [] } }, "x")).toBeNull();
    expect(pickMatchingSearchTitle({}, "x")).toBeNull();
  });

  it("keeps short blurbs whole and truncates long ones at a sentence boundary", () => {
    expect(buildBlurb("A short intro.")).toBe("A short intro.");

    const long =
      "Reynisfjara is a black-sand beach on the South Coast of Iceland. " +
      "It is known for its basalt columns and powerful sneaker waves that can be dangerous for visitors who stand too close to the water.";
    const blurb = buildBlurb(long, 90);
    expect(blurb).toBe(
      "Reynisfjara is a black-sand beach on the South Coast of Iceland.",
    );
  });

  it("falls back to word-boundary truncation with an ellipsis", () => {
    const noSentenceStop =
      "Snaefellsjokull National Park protects the glacier-capped volcano and surrounding lava fields of the peninsula";
    const blurb = buildBlurb(noSentenceStop, 40);
    expect(blurb.length).toBeLessThanOrEqual(41);
    expect(blurb.endsWith("…")).toBe(true);
    expect(blurb).not.toContain("  ");
  });

  it("returns null blurb for empty or non-string input", () => {
    expect(buildBlurb("   ")).toBeNull();
    expect(buildBlurb(null)).toBeNull();
    expect(buildBlurb(undefined)).toBeNull();
  });

  it("strips tags and decodes common entities", () => {
    expect(stripHtml('<b>A</b> &amp; B &lt;3')).toBe("A & B <3");
    expect(stripHtml(null)).toBe("");
  });

  it("drops native-name / IPA pronunciation glosses but keeps useful parentheticals", () => {
    const cases = [
      [
        "The National Museum of Iceland (Icelandic: Þjóðminjasafn Íslands [ˈθjouð]) is a museum.",
        "The National Museum of Iceland is a museum.",
      ],
      ["Gullfoss (Icelandic: [ˈkʏtlˌfɔsː]) is a waterfall.", "Gullfoss is a waterfall."],
      // IPA transcriptions that embed parentheses must still be removed whole.
      [
        "Skógafoss (pronounced [ˈskouː(ɣ)aˌfɔsː] ) is a waterfall.",
        "Skógafoss is a waterfall.",
      ],
      [
        "The National Museum of Iceland (Icelandic: Þjóðminjasafn Íslands [ˈθjouðˌmɪnjaˌsapn ˈistlan(t)s]) is a museum.",
        "The National Museum of Iceland is a museum.",
      ],
      [
        "Hallgrímskirkja (Icelandic pronunciation: [ˈh?]) is a church.",
        "Hallgrímskirkja is a church.",
      ],
      // A non-gloss parenthetical (no IPA/colon) is preserved.
      ["The CN Tower (553 m) dominates the skyline.", "The CN Tower (553 m) dominates the skyline."],
    ];
    for (const [input, expected] of cases) {
      expect(stripPronunciationGlosses(input).replace(/\s+/g, " ").trim()).toBe(
        expected,
      );
    }
    expect(stripPronunciationGlosses(null)).toBe("");
  });

  it("anchors the search query with the destination place name", () => {
    expect(buildSearchQuery("Banff Avenue", "banff-national-park")).toBe(
      "Banff Avenue Banff National Park",
    );
    expect(buildSearchQuery("Gullfoss", "iceland")).toBe("Gullfoss Iceland");
    // No slug context: fall back to the bare name.
    expect(buildSearchQuery("Gullfoss", null)).toBe("Gullfoss");
    expect(buildSearchQuery("Gullfoss", "")).toBe("Gullfoss");
  });

  it("humanizes a destination slug into a place name", () => {
    expect(slugToPlaceName("banff-national-park")).toBe("Banff National Park");
    expect(slugToPlaceName("iceland")).toBe("Iceland");
    expect(slugToPlaceName("")).toBe("");
    expect(slugToPlaceName(null)).toBe("");
  });

  it("accepts a resolved title that shares the candidate's distinctive words", () => {
    expect(titleMatchesCandidate("Banff Avenue", "Banff Avenue")).toBe(true);
    // Partial but clearly the same subject.
    expect(
      titleMatchesCandidate("Banff Gondola and Sulphur Mountain", "Sulphur Mountain"),
    ).toBe(true);
    expect(titleMatchesCandidate("Peyto Lake Viewpoint", "Peyto Lake")).toBe(true);
  });

  it("rejects an unrelated top hit for a generically named candidate", () => {
    // Real regressions seen in the Banff data set: the top search hit was a
    // different subject that happened to rank first.
    expect(
      titleMatchesCandidate("Banff Avenue", "Dragon Fli Empire"),
    ).toBe(false);
    expect(
      titleMatchesCandidate("Hoodoos Viewpoint", "Red Rock Coulee"),
    ).toBe(false);
    expect(
      titleMatchesCandidate("Mount Norquay Lookout", "Banff Sunshine Village"),
    ).toBe(false);
    // Sharing only a generic geography word ("Tunnel") is not enough.
    expect(
      titleMatchesCandidate("Tunnel Mountain Trail", "Sideling Hill Tunnel"),
    ).toBe(false);
  });

  it("does not match on a shared generic type word alone", () => {
    // Same-type confusions must be rejected: only "Mount"/"Lake" is shared.
    expect(titleMatchesCandidate("Mount Norquay Lookout", "Mount Kerkeslin")).toBe(
      false,
    );
    expect(titleMatchesCandidate("Two Jack Lake", "Lake Minnewanka")).toBe(false);
    // ...but the real distinctive word ("Norquay") is accepted.
    expect(titleMatchesCandidate("Mount Norquay Lookout", "Mount Norquay")).toBe(
      true,
    );
  });

  it("treats the destination's own name as non-distinctive", () => {
    // Within Banff, "Banff" is not distinguishing, so the broad park article
    // must not win over the actual subject ("Sulphur Mountain").
    expect(
      titleMatchesCandidate(
        "Banff Gondola and Sulphur Mountain",
        "Banff National Park",
        "banff-national-park",
      ),
    ).toBe(false);
    expect(
      titleMatchesCandidate(
        "Banff Gondola and Sulphur Mountain",
        "Sulphur Mountain",
        "banff-national-park",
      ),
    ).toBe(true);
    // A name anchored only by the destination word still resolves via overlap.
    expect(
      titleMatchesCandidate("Banff Avenue", "Banff", "banff-national-park"),
    ).toBe(true);
  });

  it("falls back to word overlap when the name has no distinctive word", () => {
    // Every token is a generic place word, so overlap is the only signal.
    expect(
      titleMatchesCandidate(
        "Cave and Basin National Historic Site",
        "Cave and Basin National Historic Site",
      ),
    ).toBe(true);
    expect(
      titleMatchesCandidate("Cave and Basin National Historic Site", "Mount Aberdeen"),
    ).toBe(false);
  });

  it("fails closed on empty or non-string titles", () => {
    expect(titleMatchesCandidate("Banff Avenue", "")).toBe(false);
    expect(titleMatchesCandidate("", "Banff Avenue")).toBe(false);
    expect(titleMatchesCandidate("Banff Avenue", null)).toBe(false);
  });

  it("buildBlurb applies gloss stripping before truncation", () => {
    expect(
      buildBlurb(
        "The National Museum of Iceland (Icelandic: Þjóðminjasafn Íslands [ˈθjouð]) is a museum.",
      ),
    ).toBe("The National Museum of Iceland is a museum.");
  });
});
