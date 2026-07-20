import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// One-time / re-runnable backfill: resolve a Google place id for each AI
// destination candidate via Places Text Search, anchored to the candidate's
// curated coordinates. The dropdown dedup in the Add Place search matches
// saved places by place id, so filled ids close the duplicate gap for places
// added through live Google search.
//
// Runs as a dry run by default; pass --apply to write.

const TEXT_SEARCH_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
// id + displayName + location are needed to verify the match; this mask stays
// within the Text Search Pro SKU.
const TEXT_SEARCH_FIELD_MASK =
  "places.id,places.displayName,places.location";
const SEARCH_RESULT_LIMIT = 5;
// Bias (not restrict) the search to the curated point, mirroring the app's
// autocomplete bias radius.
const SEARCH_BIAS_RADIUS_METERS = 50_000;
// A result farther than this from the curated coordinates is rejected. Wide
// because Google's marker for a large natural POI (Lake Minnewanka,
// Thingvellir) can sit far from the curated centroid; wrong-place homonyms
// are rejected by the name score below, not by distance alone.
const MAX_MATCH_DISTANCE_METERS = 15_000;
// Minimum name-token overlap (shared / larger token set) for a result to
// count as the same place. Low because the distinctive-token guard below is
// the primary defense; the floor only rejects results with next to nothing
// in common ("Earth Lagoon Mývatn" for "Myvatn Nature Baths" fails closed).
const MIN_NAME_MATCH_SCORE = 0.3;

// Words that carry no identifying signal when comparing a candidate name to a
// result name.
const NAME_STOPWORDS = new Set(["the", "of", "and", "at", "de", "la"]);

// Generic place-type words, mirroring the image backfill's guard. A result
// sharing only these with the candidate ("Víkurfjara Black Sand Beach" vs
// "Reynisfjara Black Sand Beach") is not a match — only a shared distinctive
// word (a proper noun) is.
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
const LETTER_FALLBACKS = { ð: "d", þ: "th", æ: "ae", ø: "o", đ: "d", ß: "ss" };
const FETCH_TIMEOUT_MS = 15_000;
const REQUEST_SPACING_MS = 150;
const EARTH_RADIUS_METERS = 6_371_000;

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests). The Places response is untrusted input;
// everything fails closed to null.
// ---------------------------------------------------------------------------

export function haversineDistanceMeters(a, b) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

// Turn a destination slug ("banff-national-park") into a human place name
// ("Banff National Park") used to anchor the text query.
export function slugToPlaceName(slug) {
  if (typeof slug !== "string") return "";
  return slug
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\p{Letter}/gu, (char) => char.toUpperCase());
}

// Split a name into folded identifying tokens: lowercase, diacritics
// stripped, punctuation dropped, stopwords and single letters removed.
export function tokenizeName(value) {
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

// Shared tokens over the larger token set, so "Old Harbour Souvenirs" scores
// lower against "Old Harbour" than the harbour itself does.
export function nameMatchScore(candidateName, resultName) {
  const candidateTokens = new Set(tokenizeName(candidateName));
  const resultTokens = new Set(tokenizeName(resultName));
  if (candidateTokens.size === 0 || resultTokens.size === 0) return 0;
  let shared = 0;
  for (const token of candidateTokens) {
    if (resultTokens.has(token)) shared += 1;
  }
  return shared / Math.max(candidateTokens.size, resultTokens.size);
}

// When the candidate name contains any distinctive word (a proper noun like
// "Reynisfjara" — not a generic place type, not the destination's own name),
// the result must share one of them. Candidates named entirely from generic
// words fall through to the score floor alone.
export function sharesDistinctiveToken(
  candidateName,
  resultName,
  destinationSlug,
) {
  const destinationTokens = new Set(
    tokenizeName(slugToPlaceName(destinationSlug)),
  );
  const distinctive = tokenizeName(candidateName).filter(
    (token) => !GENERIC_NAME_TOKENS.has(token) && !destinationTokens.has(token),
  );
  if (distinctive.length === 0) return true;
  const resultTokens = new Set(tokenizeName(resultName));
  return distinctive.some((token) => resultTokens.has(token));
}

// Pick the result that best matches the candidate by name, using distance
// only as a cap and a tiebreaker. Returns { placeId, displayName, score,
// distanceMeters } or null when nothing qualifies.
export function pickPlaceMatch(
  responseJson,
  candidate,
  maxDistanceMeters = MAX_MATCH_DISTANCE_METERS,
  minNameScore = MIN_NAME_MATCH_SCORE,
) {
  const places = responseJson?.places;
  if (!Array.isArray(places)) return null;

  let best = null;
  for (const place of places) {
    const placeId = typeof place?.id === "string" && place.id ? place.id : null;
    const latitude = place?.location?.latitude;
    const longitude = place?.location?.longitude;
    const displayName =
      typeof place?.displayName?.text === "string"
        ? place.displayName.text
        : null;
    if (
      placeId === null ||
      displayName === null ||
      typeof latitude !== "number" ||
      typeof longitude !== "number"
    ) {
      continue;
    }

    const distanceMeters = haversineDistanceMeters(
      { latitude: candidate.latitude, longitude: candidate.longitude },
      { latitude, longitude },
    );
    if (distanceMeters > maxDistanceMeters) continue;

    const score = nameMatchScore(candidate.name, displayName);
    if (score < minNameScore) continue;
    if (
      !sharesDistinctiveToken(
        candidate.name,
        displayName,
        candidate.destination_slug,
      )
    ) {
      continue;
    }

    if (
      best === null ||
      score > best.score ||
      (score === best.score && distanceMeters < best.distanceMeters)
    ) {
      best = { placeId, displayName, score, distanceMeters };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Network (side-effecting)
// ---------------------------------------------------------------------------

async function searchPlace(apiKey, candidate) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(TEXT_SEARCH_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
        "x-goog-fieldmask": TEXT_SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `${candidate.name}, ${slugToPlaceName(candidate.destination_slug)}`,
        maxResultCount: SEARCH_RESULT_LIMIT,
        locationBias: {
          circle: {
            center: {
              latitude: candidate.latitude,
              longitude: candidate.longitude,
            },
            radius: SEARCH_BIAS_RADIUS_METERS,
          },
        },
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Places Text Search ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function backfillCandidatePlaceIds({
  supabase,
  apiKey,
  destinationSlug = null,
  apply = false,
} = {}) {
  let query = supabase
    .from("ai_destination_candidates")
    .select("id, destination_slug, name, latitude, longitude")
    .is("google_place_id", null)
    .order("destination_slug", { ascending: true })
    .order("sort_order", { ascending: true });
  if (destinationSlug) query = query.eq("destination_slug", destinationSlug);

  const { data: candidates, error } = await query;
  if (error) throw new Error(`Could not load candidates: ${error.message}`);

  const summary = { total: candidates.length, matched: 0, skipped: 0, failed: 0 };
  console.log(
    `${apply ? "Applying" : "Dry run"}: ${candidates.length} candidates without a place id.\n`,
  );

  for (const candidate of candidates) {
    try {
      const match = pickPlaceMatch(await searchPlace(apiKey, candidate), candidate);
      if (!match) {
        summary.skipped += 1;
        console.log(
          `- skip  ${candidate.destination_slug} · ${candidate.name} (no name-matching result within ${MAX_MATCH_DISTANCE_METERS}m)`,
        );
        continue;
      }

      if (apply) {
        const { error: updateError } = await supabase
          .from("ai_destination_candidates")
          .update({
            google_place_id: match.placeId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", candidate.id);
        if (updateError) throw new Error(updateError.message);
      }

      summary.matched += 1;
      console.log(
        `✓ ${apply ? "write" : "match"} ${candidate.destination_slug} · ${candidate.name} → "${match.displayName}" (${Math.round(match.distanceMeters)}m, score ${match.score.toFixed(2)})`,
      );
    } catch (candidateError) {
      summary.failed += 1;
      console.warn(
        `✗ fail  ${candidate.destination_slug} · ${candidate.name}: ${candidateError.message}`,
      );
    }

    await sleep(REQUEST_SPACING_MS);
  }

  console.log(
    `\nDone. ${summary.matched} ${apply ? "written" : "matched"}, ${summary.skipped} skipped, ${summary.failed} failed of ${summary.total}.`,
  );
  return summary;
}

// ---------------------------------------------------------------------------
// CLI wrapper (thin)
// ---------------------------------------------------------------------------

function loadEnvFile(fileName) {
  const envPath = path.join(process.cwd(), fileName);
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function parseArgs(argv) {
  const options = { destinationSlug: null, apply: false };
  for (const arg of argv) {
    if (arg === "--apply") options.apply = true;
    else if (arg.startsWith("--destination=")) {
      options.destinationSlug = arg.slice("--destination=".length) || null;
    }
  }
  return options;
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const url = process.env.SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ??
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!url || !key || !apiKey) {
    throw new Error(
      "Set SUPABASE_URL, SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), and GOOGLE_PLACES_API_KEY before running this script.",
    );
  }

  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { destinationSlug, apply } = parseArgs(process.argv.slice(2));
  await backfillCandidatePlaceIds({ supabase, apiKey, destinationSlug, apply });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
