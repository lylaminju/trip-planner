import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

const sourceUrl = "https://maps.app.goo.gl/qaVycWwrraarnLtQ6";
const endpoint =
  "https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=en&gl=ca&pb=%211m4%211s4-dXS8zG87kRcBBAscU-EA%212e1%213m1%211e1%212e2%213e2%214i500%216m3%211s544KaqTQO5uU5OMP1azguA0%2115i204459%2128e2%2116b1";

const dbPath = path.join(process.cwd(), "data", "trip-planner.sqlite");

const response = await fetch(endpoint);
if (!response.ok) {
  throw new Error(`Google saved-list request failed: ${response.status} ${response.statusText}`);
}

const text = await response.text();
const payload = JSON.parse(text.replace(/^\)\]\}'\n/, ""));
const root = payload?.[0];
const rows = root?.[8];

if (!Array.isArray(rows)) {
  throw new Error("Could not find place rows at payload[0][8].");
}

const places = rows.map(parsePlace).filter((place) => place.name && place.latitude !== null && place.longitude !== null);

mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
migrate(db);

const importRows = db.transaction(() => {
  const existingRows = db.prepare("SELECT * FROM places").all();
  const update = db.prepare(`
    UPDATE places SET
      google_maps_url = @googleMapsUrl,
      place_id = @placeId,
      google_place_token = @googlePlaceToken,
      google_internal_ids = @googleInternalIds,
      source_list_url = @sourceListUrl,
      latitude = @latitude,
      longitude = @longitude,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);

  const insert = db.prepare(`
    INSERT INTO places (
      name,
      address,
      google_maps_url,
      place_id,
      google_place_token,
      google_internal_ids,
      source_list_url,
      latitude,
      longitude,
      visit_date,
      visit_time,
      notes
    ) VALUES (
      @name,
      @address,
      @googleMapsUrl,
      @placeId,
      @googlePlaceToken,
      @googleInternalIds,
      @sourceListUrl,
      @latitude,
      @longitude,
      NULL,
      NULL,
      @notes
    )
  `);

  for (const place of places) {
    const existing = findExistingPlace(place, existingRows);
    if (existing) {
      update.run({ ...place, id: existing.id });
    } else {
      insert.run(place);
    }
  }
});

importRows();

console.log(`Imported ${places.length} places from ${sourceUrl}`);
console.log(`List title: ${root?.[4] ?? "Unknown"}`);

function parsePlace(row) {
  const meta = row?.[1] ?? [];
  const coords = meta?.[5] ?? [];
  const internalIds = meta?.[6] ?? null;
  const placeToken = typeof meta?.[7] === "string" ? meta[7] : null;

  return {
    name: cleanString(row?.[2]),
    address: cleanString(meta?.[2] || meta?.[4]) || null,
    googleMapsUrl: buildGoogleMapsUrl(row?.[2], coords?.[2], coords?.[3]),
    placeId: null,
    googlePlaceToken: placeToken,
    googleInternalIds: internalIds ? JSON.stringify(internalIds) : null,
    sourceListUrl: sourceUrl,
    latitude: typeof coords?.[2] === "number" ? coords[2] : null,
    longitude: typeof coords?.[3] === "number" ? coords[3] : null,
    notes: cleanString(row?.[3]) || null,
  };
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildGoogleMapsUrl(name, latitude, longitude) {
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  const query = encodeURIComponent(`${cleanString(name)} ${latitude},${longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function migrate(database) {
  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      google_maps_url TEXT NOT NULL,
      place_id TEXT,
      google_place_token TEXT,
      google_internal_ids TEXT,
      source_list_url TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      visit_date TEXT,
      visit_time TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS route_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      to_place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      mode TEXT NOT NULL DEFAULT 'walking' CHECK (mode IN ('walking', 'transit', 'bicycling', 'driving')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS route_geometry_cache (
      cache_key TEXT PRIMARY KEY,
      from_place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      to_place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      mode TEXT NOT NULL CHECK (mode IN ('walking', 'transit', 'bicycling', 'driving')),
      from_latitude REAL NOT NULL,
      from_longitude REAL NOT NULL,
      to_latitude REAL NOT NULL,
      to_longitude REAL NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('ok', 'no_route')),
      encoded_polyline TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function findExistingPlace(imported, existingRows) {
  if (imported.placeId) {
    const match = existingRows.find((row) => row.place_id === imported.placeId);
    if (match) return match;
  }

  if (imported.googlePlaceToken) {
    const match = existingRows.find((row) => row.google_place_token === imported.googlePlaceToken);
    if (match) return match;
  }

  if (imported.googleInternalIds) {
    const match = existingRows.find((row) => row.google_internal_ids === imported.googleInternalIds);
    if (match) return match;
  }

  return null;
}
