import { isHttpUrl } from "./safe-links";

// Notes render as plain text everywhere (place rows, visit rows, the map card),
// so a markdown link the planner writes into a note shows its raw
// `[label](url)` syntax. The label stays in the note as ordinary prose and the
// URL moves onto the place's links, which are already rendered as anchors.

// The planner's web-search citations arrive tagged with their referrer. A saved
// link should be the plain destination, so the tag is dropped.
const TRACKING_QUERY_PARAM = "utm_source";

// Deliberately no parentheses inside the URL: an unescaped `)` ends the link in
// markdown too, so stopping there matches how the text was written.
const MARKDOWN_LINK_PATTERN = /\[([^\]]*)\]\(\s*([^()\s]+)\s*\)/g;

const WWW_PREFIX = /^www\./i;

export type NoteWithLinks = {
  notes: string | null;
  links: string[];
};

export function extractNoteLinks(notes: string | null): NoteWithLinks {
  if (!notes) {
    return { notes: null, links: [] };
  }

  const links: string[] = [];
  const strippedNotes = notes.replace(
    MARKDOWN_LINK_PATTERN,
    (_match, label: string, url: string) => {
      // Anything that is not a plain web URL still loses its markdown, it just
      // never becomes a stored link.
      if (!isHttpUrl(url)) {
        return label.trim();
      }

      const cleanedUrl = withoutTrackingParam(url);
      if (!links.includes(cleanedUrl)) {
        links.push(cleanedUrl);
      }
      // The planner cites a source as "([example.com](https://example.com/x))".
      // A label that only repeats the host is the link written out, not prose,
      // so it leaves with the URL instead of staying behind as a bare domain.
      return isHostLabel(label, url) ? "" : label.trim();
    },
  );

  return { notes: tidyNoteText(strippedNotes), links };
}

function withoutTrackingParam(url: string): string {
  // Only reached for URLs isHttpUrl already parsed, so this cannot throw.
  const parsed = new URL(url);
  if (!parsed.searchParams.has(TRACKING_QUERY_PARAM)) {
    return url;
  }

  parsed.searchParams.delete(TRACKING_QUERY_PARAM);
  return parsed.toString();
}

function isHostLabel(label: string, url: string): boolean {
  const host = new URL(url).hostname.replace(WWW_PREFIX, "").toLowerCase();
  const labelText = label
    .trim()
    .replace(WWW_PREFIX, "")
    .replace(/\/+$/, "")
    .toLowerCase();

  return labelText === host;
}

function tidyNoteText(notes: string): string | null {
  return (
    notes
      // A citation's parentheses are left holding nothing once its label goes.
      .replace(/\(\s*\)/g, "")
      // Removing a link can leave the gap its surrounding spaces used to fill.
      .replace(/[ \t]+([.,;:!?])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .trim() || null
  );
}
