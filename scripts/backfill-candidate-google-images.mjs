import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// One-time / re-runnable backfill: for each AI destination candidate that still
// has no image, source a lead photo from Google Places and store it in Supabase
// Storage with attribution. Mirrors the app's request-path resolver
// (src/server/google-candidate-images.ts): IDs-Only Text Search ($0) ->
// IDs-Only Place Details for the photo reference ($0) -> one billed Place Photo
// media call per candidate that actually has a photo.
//
// Runs as a dry run by default (only the $0 IDs-Only lookups, no billed photo
// fetch, no writes); pass --apply to fetch photos, upload, write rows, and log
// each billed call to the usage ledger.

const SEARCH_TEXT_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places";
const PLACES_MEDIA_BASE = "https://places.googleapis.com/v1";

// Text Search masked to the place id alone stays in the free IDs-Only SKU; any
// richer field escalates the whole request to a billed tier.
const SEARCH_TEXT_FIELD_MASK = "places.id";
// id + photos are both Essentials IDs-Only fields, so resolving the photo
// reference is free — the image itself is the separate billed Place Photo call.
const PHOTO_REFERENCE_FIELD_MASK = "id,photos";
// Same soft-bias contract as the app: rank results near the destination first
// without excluding an exact-name match elsewhere.
const SEARCH_BIAS_RADIUS_METERS = 50_000;

// Card thumbnails render in a ~104px box; 480px covers retina without pulling
// cover-sized bytes. Google resizes server-side, so no local processing.
const CANDIDATE_IMAGE_MAX_WIDTH_PX = 480;
const CANDIDATE_IMAGE_MAX_HEIGHT_PX = 480;
const CANDIDATE_IMAGES_BUCKET = "candidate-images";

// Google's free Place Photo allotment is small (~1,000/month); keep an internal
// ceiling below it so a backfill can never spill into paid usage. Mirrors
// PLACES_PHOTO_MONTHLY_LIMIT in src/server/supabase-google-places-usage-store.ts.
const PLACES_PHOTO_MONTHLY_LIMIT = 900;
const PLACES_PHOTO_SKU = "photo";

const FETCH_TIMEOUT_MS = 15_000;
const REQUEST_SPACING_MS = 150;

// ---------------------------------------------------------------------------
// Pure parsers (exported for tests). The Places response is untrusted input;
// everything fails closed to null.
// ---------------------------------------------------------------------------

export function parseFirstSearchPlaceId(payload) {
  const places = payload?.places;
  if (!Array.isArray(places)) return null;
  const id = places[0]?.id;
  return typeof id === "string" && id ? id : null;
}

export function parsePhotoReference(payload) {
  const photos = payload?.photos;
  if (!Array.isArray(photos)) return { photoName: null, attribution: null };
  const name = photos[0]?.name;
  const photoName = typeof name === "string" && name ? name : null;
  if (!photoName) return { photoName: null, attribution: null };
  const attributions = photos[0]?.authorAttributions;
  const author = Array.isArray(attributions)
    ? attributions[0]?.displayName
    : null;
  return {
    photoName,
    attribution: typeof author === "string" && author ? author : null,
  };
}

export function googleImageCredit(author) {
  return author ? `${author}, via Google Maps` : "Google Maps";
}

// Turn a destination slug ("banff-national-park") into a human place name
// ("Banff National Park") used to anchor the free-text search.
export function slugToPlaceName(slug) {
  if (typeof slug !== "string") return "";
  return slug
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\p{Letter}/gu, (char) => char.toUpperCase());
}

// Custom catalog keys contain commas and dots ("custom-pt-lisbon-38.7,-9.1"),
// which Supabase Storage rejects in object keys; curated slugs pass unchanged.
export function storageSafeSlug(slug) {
  return slug.replace(/[^a-z0-9-]+/gi, "-");
}

// ---------------------------------------------------------------------------
// Network + storage (side-effecting)
// ---------------------------------------------------------------------------

async function placesFetchJson({ url, apiKey, fieldMask, method, body }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
        "x-goog-fieldmask": fieldMask,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Places API ${response.status} ${response.statusText}`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Free IDs-Only Text Search; trusts the top result, exactly as the app's
// request-path resolver does.
async function searchPlaceId(apiKey, candidate) {
  const payload = await placesFetchJson({
    url: SEARCH_TEXT_ENDPOINT,
    apiKey,
    fieldMask: SEARCH_TEXT_FIELD_MASK,
    method: "POST",
    body: {
      textQuery: `${candidate.name}, ${slugToPlaceName(candidate.destination_slug)}`,
      ...(candidate.latitude !== null && candidate.longitude !== null
        ? {
            locationBias: {
              circle: {
                center: {
                  latitude: candidate.latitude,
                  longitude: candidate.longitude,
                },
                radius: SEARCH_BIAS_RADIUS_METERS,
              },
            },
          }
        : {}),
    },
  });
  return parseFirstSearchPlaceId(payload);
}

// Free IDs-Only Place Details returning the photo reference and its required
// author attribution.
async function fetchPhotoReference(apiKey, placeId) {
  const payload = await placesFetchJson({
    url: `${DETAILS_ENDPOINT}/${encodeURIComponent(placeId)}`,
    apiKey,
    fieldMask: PHOTO_REFERENCE_FIELD_MASK,
    method: "GET",
  });
  return parsePhotoReference(payload);
}

// The one billed call: fetch the actual image bytes.
async function fetchPhotoBytes(apiKey, photoName) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // photoName already has "places/.../photos/..." form; its slashes are path
    // separators, so do not URL-encode them.
    const response = await fetch(
      `${PLACES_MEDIA_BASE}/${photoName}/media?maxWidthPx=${CANDIDATE_IMAGE_MAX_WIDTH_PX}&maxHeightPx=${CANDIDATE_IMAGE_MAX_HEIGHT_PX}`,
      { method: "GET", headers: { "x-goog-api-key": apiKey }, signal: controller.signal },
    );
    if (!response.ok) {
      throw new Error(`Place Photo ${response.status} ${response.statusText}`);
    }
    return {
      bytes: await response.arrayBuffer(),
      contentType: response.headers.get("content-type") ?? "image/jpeg",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function uploadCandidateImage(supabase, candidate, photo) {
  const extension = photo.contentType === "image/png" ? "png" : "jpg";
  const objectPath = `${storageSafeSlug(candidate.destination_slug)}/${candidate.id}.${extension}`;
  const { error } = await supabase.storage
    .from(CANDIDATE_IMAGES_BUCKET)
    .upload(objectPath, Buffer.from(photo.bytes), {
      contentType: photo.contentType,
      upsert: true,
    });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return supabase.storage.from(CANDIDATE_IMAGES_BUCKET).getPublicUrl(objectPath).data
    .publicUrl;
}

async function recordPhotoCall(supabase, userId) {
  if (!userId) return;
  const { error } = await supabase
    .from("google_places_api_calls")
    .insert({ user_id: userId, sku: PLACES_PHOTO_SKU });
  if (error) throw new Error(`Ledger insert failed: ${error.message}`);
}

async function countPhotoCallsThisMonth(supabase) {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("google_places_api_calls")
    .select("*", { count: "exact", head: true })
    .eq("sku", PLACES_PHOTO_SKU)
    .gte("called_at", monthStart.toISOString());
  if (error) throw new Error(`Could not count photo usage: ${error.message}`);
  return count ?? 0;
}

// Any valid auth user id keeps the monthly total honest; the per-user daily cap
// is irrelevant for a one-off admin backfill. Falls back to null (recording is
// then skipped with a warning) rather than blocking the backfill.
async function resolveLedgerUserId(supabase) {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error || !data?.length) return null;
  return data[0].user_id ?? null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function backfillCandidateGoogleImages({
  supabase,
  apiKey,
  destinationSlug = null,
  apply = false,
  ledgerUserId = null,
} = {}) {
  let query = supabase
    .from("ai_destination_candidates")
    .select("id, destination_slug, name, latitude, longitude, google_place_id")
    .is("image_url", null)
    .order("destination_slug", { ascending: true })
    .order("sort_order", { ascending: true });
  if (destinationSlug) query = query.eq("destination_slug", destinationSlug);

  const { data: candidates, error } = await query;
  if (error) throw new Error(`Could not load candidates: ${error.message}`);

  const usedThisMonth = await countPhotoCallsThisMonth(supabase);
  let photoBudget = Math.max(0, PLACES_PHOTO_MONTHLY_LIMIT - usedThisMonth);

  const summary = {
    total: candidates.length,
    withPhoto: 0,
    noPlaceId: 0,
    noPhoto: 0,
    updated: 0,
    billed: 0,
    budgetSkipped: 0,
    failed: 0,
  };

  console.log(
    `${apply ? "Applying" : "Dry run"}: ${candidates.length} imageless candidate(s).`,
  );
  console.log(
    `Place Photo budget: ${usedThisMonth}/${PLACES_PHOTO_MONTHLY_LIMIT} used this month, ${photoBudget} remaining.\n`,
  );

  for (const candidate of candidates) {
    const label = `${candidate.destination_slug} · ${candidate.name}`;
    try {
      const placeId =
        candidate.google_place_id ?? (await searchPlaceId(apiKey, candidate));
      if (!placeId) {
        summary.noPlaceId += 1;
        console.log(`- skip  ${label} (no place id match)`);
        continue;
      }

      const { photoName, attribution } = await fetchPhotoReference(apiKey, placeId);
      if (!photoName) {
        summary.noPhoto += 1;
        console.log(`- skip  ${label} (place has no Google photo)`);
        // Persist the resolved id even without a photo so future runs and the
        // Add-place dedup can reuse it (apply only).
        if (apply && !candidate.google_place_id) {
          await writeRow(supabase, candidate.id, { google_place_id: placeId });
        }
        continue;
      }

      summary.withPhoto += 1;

      if (!apply) {
        console.log(`~ photo ${label} (would fetch + save)`);
        continue;
      }

      if (photoBudget <= 0) {
        summary.budgetSkipped += 1;
        console.log(`- defer ${label} (monthly Place Photo budget exhausted)`);
        continue;
      }

      const photo = await fetchPhotoBytes(apiKey, photoName);
      await recordPhotoCall(supabase, ledgerUserId);
      summary.billed += 1;
      photoBudget -= 1;

      const imageUrl = await uploadCandidateImage(supabase, candidate, photo);
      await writeRow(supabase, candidate.id, {
        image_url: imageUrl,
        image_credit: googleImageCredit(attribution),
        google_place_id: placeId,
      });
      summary.updated += 1;
      console.log(`✓ image ${label}`);
    } catch (candidateError) {
      summary.failed += 1;
      console.warn(`✗ fail  ${label}: ${candidateError.message}`);
    }

    await sleep(REQUEST_SPACING_MS);
  }

  console.log(
    `\nDone. ${apply ? `${summary.updated} images saved (${summary.billed} billed photo call(s))` : `${summary.withPhoto} would get a photo`}, ` +
      `${summary.noPhoto} no photo, ${summary.noPlaceId} no place id, ` +
      `${summary.budgetSkipped} budget-deferred, ${summary.failed} failed of ${summary.total}.`,
  );
  if (!ledgerUserId && apply && summary.billed > 0) {
    console.warn(
      "\n! No ledger user id resolved: billed photo calls were NOT recorded in google_places_api_calls.",
    );
  }
  return summary;
}

async function writeRow(supabase, id, patch) {
  const { error } = await supabase
    .from("ai_destination_candidates")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
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
  const ledgerUserId = apply ? await resolveLedgerUserId(supabase) : null;
  await backfillCandidateGoogleImages({
    supabase,
    apiKey,
    destinationSlug,
    apply,
    ledgerUserId,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
