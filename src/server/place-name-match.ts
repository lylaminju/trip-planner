// Name matching for a Google Places result resolved from a model-authored
// candidate name. The model names places loosely ("Staircase to Chedoke
// Falls", "Bruce Trail at the Escarpment"), so a search result is trusted only
// when it shares the candidate's distinctive words. Matching on generic place
// words alone would accept a same-type place elsewhere in the city, and a
// wrong match now costs more than a missing one: the resolved place supplies
// the row's coordinates.
//
// scripts/backfill-candidate-place-ids.mjs carries an equivalent copy of these
// helpers. A plain .mjs script cannot import this module while tsconfig sets
// allowJs false and no TypeScript runner is installed, so the two are kept in
// step by hand; change both or neither.

// Shared tokens over the larger token set must reach this for a result to
// count as the same place. Low because the distinctive-token guard below is
// the primary defense; the floor only rejects results with next to nothing in
// common ("Earth Lagoon Mývatn" for "Myvatn Nature Baths" fails closed).
export const MIN_NAME_MATCH_SCORE = 0.3;

// Words that carry no identifying signal when comparing two place names.
const NAME_STOPWORDS = new Set(["the", "of", "and", "at", "de", "la"]);

// Generic place-type words. A result sharing only these with the candidate
// ("Víkurfjara Black Sand Beach" vs "Reynisfjara Black Sand Beach") is not a
// match — only a shared distinctive word (a proper noun) is.
const GENERIC_NAME_TOKENS = new Set([
  "mount", "mountain", "mountains", "mt", "peak", "summit", "ridge", "pass",
  "lake", "lakes", "pond", "reservoir", "bay", "cove", "beach", "sand", "black",
  "trail", "trails", "path", "loop", "route", "tunnel",
  "canyon", "gorge", "falls", "fall", "waterfall", "cascade", "cascades",
  "river", "creek", "stream", "brook", "glacier", "glaciers", "icefield",
  "park", "garden", "gardens", "national", "provincial", "state",
  "viewpoint", "lookout", "overlook", "point",
  "hot", "spring", "springs", "geyser",
  "hill", "hills", "valley", "meadow", "meadows", "plain", "plains", "field",
  "gondola", "tramway", "lift", "sightseeing",
  "avenue", "ave", "street", "road", "boulevard", "drive", "way", "lane",
  "cave", "caves", "basin", "historic", "historical", "site", "monument",
  "upper", "lower", "north", "south", "east", "west", "central", "old",
  "tea", "house", "village", "resort", "town", "city", "island",
  "bridge", "square", "museum", "tower", "cathedral", "church", "temple",
  "palace", "castle", "station", "market", "hall", "center", "centre",
  "harbour", "harbor", "shopping", "district",
]);

// Letters that NFD normalization cannot reduce to ASCII, mapped by hand so
// "Goðafoss" matches "Godafoss".
const LETTER_FALLBACKS: Record<string, string> = {
  ð: "d",
  þ: "th",
  æ: "ae",
  ø: "o",
  đ: "d",
  ß: "ss",
};

/**
 * Splits a name into folded identifying tokens: lowercase, diacritics
 * stripped, punctuation dropped, stopwords and single letters removed.
 */
export function tokenizeName(value: string): string[] {
  if (typeof value !== "string") return [];
  return value
    .toLowerCase()
    .replace(/[ðþæøđß]/g, (letter) => LETTER_FALLBACKS[letter] ?? letter)
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !NAME_STOPWORDS.has(token));
}

/**
 * Shared tokens over the larger token set, so "Old Harbour Souvenirs" scores
 * lower against "Old Harbour" than the harbour itself does.
 */
export function nameMatchScore(
  candidateName: string,
  resultName: string,
): number {
  const candidateTokens = new Set(tokenizeName(candidateName));
  const resultTokens = new Set(tokenizeName(resultName));
  if (candidateTokens.size === 0 || resultTokens.size === 0) return 0;

  let shared = 0;
  for (const token of candidateTokens) {
    if (resultTokens.has(token)) shared += 1;
  }
  return shared / Math.max(candidateTokens.size, resultTokens.size);
}

/**
 * When the candidate name contains any distinctive word (a proper noun like
 * "Reynisfjara" — not a generic place type, not the destination's own name),
 * the result must share one of them. Candidates named entirely from generic
 * words fall through to the score floor alone.
 */
export function sharesDistinctiveToken(
  candidateName: string,
  resultName: string,
  destinationName: string,
): boolean {
  const destinationTokens = new Set(tokenizeName(destinationName));
  const distinctive = tokenizeName(candidateName).filter(
    (token) => !GENERIC_NAME_TOKENS.has(token) && !destinationTokens.has(token),
  );
  if (distinctive.length === 0) return true;

  const resultTokens = new Set(tokenizeName(resultName));
  return distinctive.some((token) => resultTokens.has(token));
}
