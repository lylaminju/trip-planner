import { describe, expect, it } from "vitest";

import { extractNoteLinks } from "@/lib/note-links";

describe("extractNoteLinks", () => {
  const cases: Array<{
    name: string;
    notes: string | null;
    expected: { notes: string | null; links: string[] };
  }> = [
    {
      name: "leaves a note without links untouched",
      notes: "Closed Mondays; book ahead.",
      expected: { notes: "Closed Mondays; book ahead.", links: [] },
    },
    {
      name: "keeps the link label as prose and lifts out the URL",
      notes:
        "Closed Mondays; check the [official hours](https://www.artgalleryofhamilton.com/visit) before going.",
      expected: {
        notes: "Closed Mondays; check the official hours before going.",
        links: ["https://www.artgalleryofhamilton.com/visit"],
      },
    },
    {
      name: "drops the utm_source tag from an extracted URL",
      notes: "See [hours](https://example.com/visit?utm_source=openai).",
      expected: {
        notes: "See hours.",
        links: ["https://example.com/visit"],
      },
    },
    {
      name: "keeps the other query parameters when dropping utm_source",
      notes:
        "See [hours](https://example.com/visit?utm_source=openai&lang=en&day=mon).",
      expected: {
        notes: "See hours.",
        links: ["https://example.com/visit?lang=en&day=mon"],
      },
    },
    {
      name: "takes a source citation's bare domain with it, parentheses and all",
      notes:
        "Confirmed open Saturday 11:00–17:00, so this fits your travel day well. ([artgalleryofhamilton.com](https://www.artgalleryofhamilton.com/plan-your-visit/?utm_source=openai))",
      expected: {
        notes:
          "Confirmed open Saturday 11:00–17:00, so this fits your travel day well.",
        links: ["https://www.artgalleryofhamilton.com/plan-your-visit/"],
      },
    },
    {
      name: "closes the gap when a citation sat mid-sentence",
      notes:
        "The gallery ([www.artgalleryofhamilton.com](https://artgalleryofhamilton.com/visit)) opens at 11:00.",
      expected: {
        notes: "The gallery opens at 11:00.",
        links: ["https://artgalleryofhamilton.com/visit"],
      },
    },
    {
      name: "collects several links in the order they appear, without repeats",
      notes:
        "Book at [tickets](https://example.com/tickets), hours on [the site](https://example.org/hours), tickets again [here](https://example.com/tickets).",
      expected: {
        notes: "Book at tickets, hours on the site, tickets again here.",
        links: ["https://example.com/tickets", "https://example.org/hours"],
      },
    },
    {
      name: "strips markdown for a non-web URL without storing it as a link",
      notes: "Email [the box office](mailto:box@example.com) to reserve.",
      expected: { notes: "Email the box office to reserve.", links: [] },
    },
    {
      name: "returns no note when the markdown link was the whole note",
      notes: "[](https://example.com/visit)",
      expected: { notes: null, links: ["https://example.com/visit"] },
    },
    {
      name: "treats an empty note as absent",
      notes: "   ",
      expected: { notes: null, links: [] },
    },
    {
      name: "treats a missing note as absent",
      notes: null,
      expected: { notes: null, links: [] },
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(extractNoteLinks(testCase.notes)).toEqual(testCase.expected);
    });
  }
});
