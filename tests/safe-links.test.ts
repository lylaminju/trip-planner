import { describe, expect, it } from "vitest";

import { isHttpUrl, sanitizeLinks } from "@/lib/safe-links";

// Stored place links become clickable anchors for every trip member, so the
// filter must fail closed: only plain web URLs pass.
describe("isHttpUrl", () => {
  it.each([
    ["https://example.com/guide", true],
    ["http://example.com/old", true],
    ["https://example.com/path?q=1#frag", true],
    ["javascript:alert(1)", false],
    ["JavaScript:alert(1)", false],
    ["data:text/html,<script>alert(1)</script>", false],
    ["vbscript:msgbox(1)", false],
    ["file:///etc/passwd", false],
    ["example.com/no-protocol", false],
    ["//example.com/protocol-relative", false],
    ["", false],
    ["   ", false],
  ])("%s -> %s", (value, expected) => {
    expect(isHttpUrl(value)).toBe(expected);
  });
});

describe("sanitizeLinks", () => {
  it("keeps only trimmed http(s) URLs from a request-supplied array", () => {
    expect(
      sanitizeLinks([
        "  https://example.com/guide  ",
        "javascript:alert(1)",
        "example.com",
        42,
        null,
        "",
        "http://example.com/old",
      ]),
    ).toEqual(["https://example.com/guide", "http://example.com/old"]);
  });

  it.each([[undefined], [null], ["https://example.com"], [{}]])(
    "returns an empty list for non-array input %#",
    (value) => {
      expect(sanitizeLinks(value)).toEqual([]);
    },
  );
});
