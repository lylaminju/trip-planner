import { describe, expect, it } from "vitest";

import {
  buildBlurb,
  extractImageCredit,
  extractPageSummary,
  pickSearchTitle,
  stripHtml,
  stripPronunciationGlosses,
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

  it("picks the top search title and handles empty results", () => {
    expect(
      pickSearchTitle({ query: { search: [{ title: "Þingvellir" }, { title: "x" }] } }),
    ).toBe("Þingvellir");
    expect(pickSearchTitle({ query: { search: [] } })).toBeNull();
    expect(pickSearchTitle({})).toBeNull();
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

  it("buildBlurb applies gloss stripping before truncation", () => {
    expect(
      buildBlurb(
        "The National Museum of Iceland (Icelandic: Þjóðminjasafn Íslands [ˈθjouð]) is a museum.",
      ),
    ).toBe("The National Museum of Iceland is a museum.");
  });
});
