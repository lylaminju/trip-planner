import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

loadEnvFile(".env.local");
loadEnvFile(".env");

const args = new Set(process.argv.slice(2));
const replaceRemote = args.has("--replace");
const dbPath =
  process.env.TRIP_PLANNER_DB_PATH ??
  path.join(process.cwd(), "data", "trip-planner.sqlite");
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY?.trim() ??
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Set SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY before running this script.",
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});
const db = new Database(dbPath, { readonly: true });

try {
  const rows = {
    places: db
      .prepare(
        `SELECT
          id, name, address, google_maps_url, place_id, google_place_token, google_internal_ids,
          source_list_url, latitude, longitude, notes, created_at, updated_at
        FROM places
        ORDER BY id`,
      )
      .all(),
    itinerary_items: db
      .prepare(
        `SELECT id, place_id, visit_date, visit_time, notes, created_at, updated_at
        FROM itinerary_items
        ORDER BY id`,
      )
      .all(),
    route_segments: db
      .prepare(
        `SELECT id, from_item_id, to_item_id, mode, created_at, updated_at
        FROM route_segments
        ORDER BY id`,
      )
      .all(),
    route_geometry_cache: db
      .prepare(
        `SELECT
          cache_key, from_place_id, to_place_id, mode, from_latitude, from_longitude,
          to_latitude, to_longitude, status, encoded_polyline, created_at, updated_at
        FROM route_geometry_cache
        ORDER BY cache_key`,
      )
      .all(),
  };

  if (replaceRemote) {
    await deleteRemoteData();
  }

  await upsertRows("places", rows.places, "id");
  await upsertRows("itinerary_items", rows.itinerary_items, "id");
  await upsertRows("route_segments", rows.route_segments, "id");
  await upsertRows(
    "route_geometry_cache",
    rows.route_geometry_cache,
    "cache_key",
  );
  await resetSequences();

  console.log(
    JSON.stringify(
      {
        dbPath,
        replaceRemote,
        imported: Object.fromEntries(
          Object.entries(rows).map(([table, tableRows]) => [
            table,
            tableRows.length,
          ]),
        ),
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}

async function deleteRemoteData() {
  await deleteWhere("route_geometry_cache", "cache_key", "");
  await deleteWhere("route_segments", "id", 0);
  await deleteWhere("itinerary_items", "id", 0);
  await deleteWhere("places", "id", 0);
}

async function deleteWhere(table, column, value) {
  const query = supabase.from(table).delete();
  const { error } =
    typeof value === "number"
      ? await query.gte(column, value)
      : await query.neq(column, value);

  if (error) {
    throw new Error(`Failed to clear ${table}: ${error.message}`);
  }
}

async function upsertRows(table, rows, onConflict) {
  if (rows.length === 0) return;

  for (const chunk of chunks(rows, 500)) {
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      if (isMissingTableError(error)) {
        throw new Error(
          `Supabase table '${table}' does not exist. Run supabase/schema.sql in the Supabase SQL editor for this project, then retry npm run push:supabase.`,
        );
      }

      throw new Error(`Failed to import ${table}: ${error.message}`);
    }
  }
}

async function resetSequences() {
  const { error } = await supabase.rpc("reset_trip_planner_id_sequences");
  if (error) {
    throw new Error(
      `Imported rows, but failed to reset Postgres id sequences. Run supabase/schema.sql and retry. ${error.message}`,
    );
  }
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function isMissingTableError(error) {
  return (
    error.code === "PGRST205" ||
    /Could not find the table .* in the schema cache/i.test(error.message ?? "")
  );
}

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
