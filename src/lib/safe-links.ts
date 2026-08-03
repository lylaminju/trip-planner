// Place links arrive from request bodies and are rendered as clickable
// anchors for every trip member, so only plain web URLs survive. Anything
// else — javascript:, data:, bare text without a protocol — is dropped at
// both the storage and render boundaries rather than rejected, matching how
// the place routes treat other optional fields.
export function isHttpUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

export function sanitizeLinks(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(isHttpUrl);
}
