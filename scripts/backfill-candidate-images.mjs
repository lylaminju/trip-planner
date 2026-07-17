import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

// One-time / re-runnable backfill: for each AI destination candidate, source a
// lead image + intro from Wikimedia, compress it to a webp thumbnail, upload it
// to Supabase Storage, and store the resulting public URL, credit, and blurb on
// the row. Wikimedia is only touched here — never in the user's request path.

const WIKIPEDIA_API_ENDPOINT = "https://en.wikipedia.org/w/api.php";
const WIKIMEDIA_USER_AGENT =
  "TripPlanner/1.0 candidate-image-backfill (https://github.com/trip-planner)";
const CANDIDATE_IMAGES_BUCKET = "candidate-images";
const THUMBNAIL_WIDTH_PX = 480;
const WEBP_QUALITY = 80;
const BLURB_MAX_LENGTH = 240;
const FETCH_TIMEOUT_MS = 15000;
const REQUEST_SPACING_MS = 800;
const MAX_RATE_LIMIT_RETRIES = 4;
const RATE_LIMIT_BACKOFF_MS = 2500;
const RATE_LIMITED_STATUS = 429;

// A resolved Wikipedia article is only trusted when its title shares this
// fraction of the candidate's distinctive words (overlap coefficient). This
// stops a generically named candidate ("Banff Avenue", "Hoodoos Viewpoint")
// from being hijacked by an unrelated top search hit.
const TITLE_MATCH_MIN_OVERLAP = 0.5;

// Consider more than the single top search hit so a correct article that ranks
// below an unrelated one ("Mount Norquay" behind "Banff Sunshine Village") can
// still be found once the guard rejects the wrong leader.
const SEARCH_RESULT_LIMIT = 5;

// Structural words that carry no identifying signal on their own, so they must
// not be counted toward a title match.
const TITLE_STOPWORDS = new Set([
  "and", "the", "of", "a", "an", "in", "on", "at",
  "to", "by", "for", "with", "near", "de", "la", "el",
]);

// Generic place-type words. A title sharing only these with the candidate
// ("Mount" Norquay vs "Mount" Kerkeslin, Two Jack "Lake" vs "Lake" Minnewanka)
// is not a match — only a shared distinctive word (a proper noun) is. Names
// built entirely from these fall back to raw word overlap instead.
const GENERIC_PLACE_TOKENS = new Set([
  "mount", "mountain", "mountains", "mt", "peak", "summit", "ridge", "pass",
  "lake", "lakes", "pond", "reservoir", "bay", "cove", "beach",
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
  "upper", "lower", "north", "south", "east", "west", "central",
  "tea", "house", "village", "resort", "town", "city", "island",
  "bridge", "square", "museum", "tower", "cathedral", "church", "temple",
  "palace", "castle", "station", "market", "hall", "center", "centre",
]);

// ---------------------------------------------------------------------------
// Pure parsers (exported for tests). All treat the Wikimedia response as
// untrusted input and fail closed to null / empty string on anything unexpected.
// ---------------------------------------------------------------------------

export function stripHtml(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function extractPageSummary(apiJson) {
  const pages = apiJson?.query?.pages;
  if (!pages || typeof pages !== "object") return null;
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) return null;
  return {
    title: typeof page.title === "string" ? page.title : null,
    imageUrl: typeof page.original?.source === "string" ? page.original.source : null,
    imageFileName: typeof page.pageimage === "string" ? page.pageimage : null,
    extract: typeof page.extract === "string" ? page.extract : null,
  };
}

// Return the first search result whose title plausibly names the candidate,
// scanning past unrelated higher-ranked hits. Falls closed to null.
export function pickMatchingSearchTitle(searchJson, candidateName, destinationSlug = null) {
  const results = searchJson?.query?.search;
  if (!Array.isArray(results)) return null;
  for (const result of results) {
    const title = typeof result?.title === "string" ? result.title : null;
    if (title && titleMatchesCandidate(candidateName, title, destinationSlug)) {
      return title;
    }
  }
  return null;
}

// Split a name/title into lowercase identifying words, dropping punctuation and
// structural stopwords. Unicode-aware so accented place names survive.
function tokenizeForMatch(value) {
  if (typeof value !== "string") return [];
  return value
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token && !TITLE_STOPWORDS.has(token));
}

// Turn a destination slug ("banff-national-park") into a human place name
// ("Banff National Park") used to geographically anchor the Wikipedia search.
export function slugToPlaceName(slug) {
  if (typeof slug !== "string") return "";
  return slug
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\p{Letter}/gu, (char) => char.toUpperCase());
}

// Anchor the free-text search with the destination so a generic candidate name
// resolves to the right place instead of an unrelated top hit.
export function buildSearchQuery(name, destinationSlug) {
  const place = slugToPlaceName(destinationSlug);
  return place ? `${name} ${place}` : name;
}

// Guard against wrong-article matches. A shared distinctive word (a proper noun
// like "Norquay" or "Peyto") is strong evidence of the same subject; a shared
// generic type word ("Mount", "Lake") is not, and neither is the destination's
// own name ("Banff"), which appears in most of its articles. So when the
// candidate name has any distinctive word, require the title to share one.
// Names built entirely from generic/destination words fall back to raw word
// overlap (TITLE_MATCH_MIN_OVERLAP, overlap coefficient = shared words / smaller
// word set) so a place like "Banff Avenue" can still resolve. Fails closed.
export function titleMatchesCandidate(
  candidateName,
  resolvedTitle,
  destinationSlug = null,
  minOverlap = TITLE_MATCH_MIN_OVERLAP,
) {
  const candidateTokens = new Set(tokenizeForMatch(candidateName));
  const titleTokens = new Set(tokenizeForMatch(resolvedTitle));
  if (candidateTokens.size === 0 || titleTokens.size === 0) return false;

  const destinationTokens = new Set(
    tokenizeForMatch(slugToPlaceName(destinationSlug)),
  );
  const distinctive = [...candidateTokens].filter(
    (token) => !GENERIC_PLACE_TOKENS.has(token) && !destinationTokens.has(token),
  );
  if (distinctive.length > 0) {
    return distinctive.some((token) => titleTokens.has(token));
  }

  let shared = 0;
  for (const token of candidateTokens) {
    if (titleTokens.has(token)) shared += 1;
  }
  return shared / Math.min(candidateTokens.size, titleTokens.size) >= minOverlap;
}

export function extractImageCredit(imageInfoJson) {
  const pages = imageInfoJson?.query?.pages;
  if (!pages || typeof pages !== "object") return null;
  const meta = Object.values(pages)[0]?.imageinfo?.[0]?.extmetadata;
  if (!meta) return null;
  const artist = stripHtml(meta.Artist?.value ?? "");
  const license = stripHtml(meta.LicenseShortName?.value ?? "");
  const who = artist || "Wikimedia Commons";
  const credit = license
    ? `${who} (${license}), via Wikimedia Commons`
    : `${who}, via Wikimedia Commons`;
  return credit.trim() || null;
}

// Wikipedia lead sentences often open with a native-name / IPA pronunciation
// gloss, e.g. "The National Museum of Iceland (Icelandic: Þjóðminjasafn Íslands
// [ˈθjouð…]) is …". Drop parentheticals that are clearly such glosses (contain a
// bracketed IPA span, a "Language:" colon, the word "pronunciation/pronounced",
// or IPA stress marks) while keeping useful ones like "(553 m)".
//
// The inner group allows one level of nested parentheses so IPA transcriptions
// that embed them — e.g. "[ˈskouː(ɣ)aˌfɔsː]" or "ˈistlan(t)s" — are matched and
// removed whole rather than leaving a dangling "(t)s])" behind.
export function stripPronunciationGlosses(text) {
  if (typeof text !== "string") return "";
  return text.replace(/\s*\([^()]*(?:\([^()]*\)[^()]*)*\)/g, (match) =>
    /[[\]:]|pronunc|ˈ|ˌ/i.test(match) ? "" : match,
  );
}

export function buildBlurb(extract, maxLength = BLURB_MAX_LENGTH) {
  if (typeof extract !== "string") return null;
  const clean = stripPronunciationGlosses(extract).replace(/\s+/g, " ").trim();
  if (!clean) return null;
  if (clean.length <= maxLength) return clean;

  const capped = clean.slice(0, maxLength);
  const lastSentenceEnd = Math.max(
    capped.lastIndexOf(". "),
    capped.lastIndexOf("! "),
    capped.lastIndexOf("? "),
  );
  if (lastSentenceEnd > maxLength * 0.5) {
    return capped.slice(0, lastSentenceEnd + 1).trim();
  }
  const lastSpace = capped.lastIndexOf(" ");
  return `${capped.slice(0, lastSpace > 0 ? lastSpace : maxLength).trim()}…`;
}

// ---------------------------------------------------------------------------
// Network + storage (side-effecting)
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url, init = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { "User-Agent": WIKIMEDIA_USER_AGENT, ...(init.headers ?? {}) },
      });
    } finally {
      clearTimeout(timer);
    }

    // Wikimedia throttles bots with 429; back off (honoring Retry-After) and retry.
    if (
      response.status === RATE_LIMITED_STATUS &&
      attempt < MAX_RATE_LIMIT_RETRIES
    ) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : RATE_LIMIT_BACKOFF_MS * (attempt + 1);
      await sleep(waitMs);
      continue;
    }

    return response;
  }
}

async function fetchWikipediaJson(params) {
  const query = new URLSearchParams({ format: "json", ...params }).toString();
  const response = await fetchWithTimeout(`${WIKIPEDIA_API_ENDPOINT}?${query}`);
  if (!response.ok) {
    throw new Error(`Wikipedia API ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function pageSummaryParams(title) {
  return {
    action: "query",
    prop: "pageimages|extracts",
    piprop: "original|name",
    exintro: "1",
    explaintext: "1",
    redirects: "1",
    titles: title,
  };
}

async function resolveCandidateMedia(name, destinationSlug = null) {
  let summary = extractPageSummary(await fetchWikipediaJson(pageSummaryParams(name)));

  // A direct-title hit is trusted only when the (redirect-resolved) page still
  // names the same place; otherwise treat it as a miss and fall back to search.
  if (summary?.imageUrl && !titleMatchesCandidate(name, summary.title, destinationSlug)) {
    summary = null;
  }

  if (!summary?.imageUrl) {
    const searchTitle = pickMatchingSearchTitle(
      await fetchWikipediaJson({
        action: "query",
        list: "search",
        srsearch: buildSearchQuery(name, destinationSlug),
        srlimit: String(SEARCH_RESULT_LIMIT),
      }),
      name,
      destinationSlug,
    );
    if (searchTitle) {
      summary = extractPageSummary(
        await fetchWikipediaJson(pageSummaryParams(searchTitle)),
      );
    }
  }

  if (!summary?.imageUrl) return null;

  let credit = null;
  if (summary.imageFileName) {
    credit = extractImageCredit(
      await fetchWikipediaJson({
        action: "query",
        prop: "imageinfo",
        iiprop: "extmetadata",
        iiextmetadatafilter: "Artist|LicenseShortName",
        titles: `File:${summary.imageFileName}`,
        redirects: "1",
      }),
    );
  }

  return { imageUrl: summary.imageUrl, credit, blurb: buildBlurb(summary.extract) };
}

async function downloadWebpThumbnail(imageUrl) {
  const response = await fetchWithTimeout(imageUrl);
  if (!response.ok) {
    throw new Error(`Image download failed: ${response.status} ${response.statusText}`);
  }
  const source = Buffer.from(await response.arrayBuffer());
  // Some Commons uploads carry recoverable JPEG defects that sharp rejects by
  // default; decode them anyway rather than lose an otherwise usable image.
  return sharp(source, { failOn: "none" })
    .resize({ width: THUMBNAIL_WIDTH_PX, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

async function ensureBucket(supabase) {
  const { error } = await supabase.storage.createBucket(CANDIDATE_IMAGES_BUCKET, {
    public: true,
  });
  if (error && !/already exists/i.test(error.message ?? "")) {
    throw new Error(`Could not create storage bucket: ${error.message}`);
  }
}

async function uploadThumbnail(supabase, destinationSlug, id, webpBuffer) {
  const objectPath = `${destinationSlug}/${id}.webp`;
  const { error } = await supabase.storage
    .from(CANDIDATE_IMAGES_BUCKET)
    .upload(objectPath, webpBuffer, { contentType: "image/webp", upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return supabase.storage.from(CANDIDATE_IMAGES_BUCKET).getPublicUrl(objectPath).data
    .publicUrl;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function backfillCandidateImages({
  supabase,
  destinationSlug = null,
  force = false,
} = {}) {
  await ensureBucket(supabase);

  let query = supabase
    .from("ai_destination_candidates")
    .select("id, destination_slug, name, blurb, image_url")
    .order("destination_slug", { ascending: true })
    .order("sort_order", { ascending: true });
  if (destinationSlug) query = query.eq("destination_slug", destinationSlug);
  if (!force) query = query.is("image_url", null);

  const { data: candidates, error } = await query;
  if (error) throw new Error(`Could not load candidates: ${error.message}`);

  const summary = {
    total: candidates.length,
    updated: 0,
    cleared: 0,
    skipped: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    try {
      const media = await resolveCandidateMedia(
        candidate.name,
        candidate.destination_slug,
      );
      if (!media) {
        // A forced re-source that finds no acceptable article must drop any
        // stale image/blurb rather than leave a wrong article attached. (Only a
        // genuine "no match" reaches here — network failures throw and are
        // handled below, so this never wipes images on a transient outage.)
        if (force && (candidate.image_url || candidate.blurb)) {
          const { error: clearError } = await supabase
            .from("ai_destination_candidates")
            .update({
              image_url: null,
              image_credit: null,
              blurb: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", candidate.id);
          if (clearError) throw new Error(clearError.message);
          summary.cleared += 1;
          console.log(`- clear ${candidate.name} (no acceptable Wikimedia match)`);
        } else {
          summary.skipped += 1;
          console.log(`- skip  ${candidate.name} (no Wikimedia image)`);
        }
        continue;
      }

      const webpBuffer = await downloadWebpThumbnail(media.imageUrl);
      const publicUrl = await uploadThumbnail(
        supabase,
        candidate.destination_slug,
        candidate.id,
        webpBuffer,
      );

      const patch = {
        image_url: publicUrl,
        image_credit: media.credit,
        updated_at: new Date().toISOString(),
      };
      // Keep the blurb sourced from the same article as the image. A forced
      // re-source refreshes it so a stale blurb can't linger against a new
      // image; otherwise only fill it when empty. (Curated copy lives in the
      // separate planning_note column, so this never clobbers hand-written text.)
      if (media.blurb && (force || !candidate.blurb)) patch.blurb = media.blurb;

      const { error: updateError } = await supabase
        .from("ai_destination_candidates")
        .update(patch)
        .eq("id", candidate.id);
      if (updateError) throw new Error(updateError.message);

      summary.updated += 1;
      console.log(`✓ image ${candidate.name}`);
    } catch (candidateError) {
      summary.failed += 1;
      console.warn(`✗ fail  ${candidate.name}: ${candidateError.message}`);
    }

    await sleep(REQUEST_SPACING_MS);
  }

  console.log(
    `\nDone. ${summary.updated} updated, ${summary.cleared} cleared, ${summary.skipped} skipped, ${summary.failed} failed of ${summary.total}.`,
  );
  return summary;
}

// Re-clean already-stored blurbs in place (no network / no image work), applying
// the current buildBlurb rules so pronunciation glosses are stripped from rows
// seeded before that logic existed.
export async function recleanBlurbs({ supabase } = {}) {
  const { data, error } = await supabase
    .from("ai_destination_candidates")
    .select("id, name, blurb")
    .not("blurb", "is", null);
  if (error) throw new Error(`Could not load candidates: ${error.message}`);

  const summary = { total: data.length, updated: 0, unchanged: 0 };

  for (const row of data) {
    const cleaned = buildBlurb(row.blurb);
    if (!cleaned || cleaned === row.blurb) {
      summary.unchanged += 1;
      continue;
    }
    const { error: updateError } = await supabase
      .from("ai_destination_candidates")
      .update({ blurb: cleaned, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (updateError) throw new Error(updateError.message);
    summary.updated += 1;
    console.log(`✓ blurb ${row.name}`);
  }

  console.log(
    `\nDone. ${summary.updated} updated, ${summary.unchanged} unchanged of ${summary.total}.`,
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
  const options = { destinationSlug: null, force: false, recleanBlurbs: false };
  for (const arg of argv) {
    if (arg === "--force") options.force = true;
    else if (arg === "--reclean-blurbs") options.recleanBlurbs = true;
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
  if (!url || !key) {
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY before running this script.",
    );
  }

  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { destinationSlug, force, recleanBlurbs: reclean } = parseArgs(
    process.argv.slice(2),
  );
  if (reclean) {
    await recleanBlurbs({ supabase });
    return;
  }
  await backfillCandidateImages({ supabase, destinationSlug, force });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
