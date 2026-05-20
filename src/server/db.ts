import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

let singleton: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (singleton) return singleton;

  const dbPath =
    process.env.TRIP_PLANNER_DB_PATH ?? path.join(process.cwd(), "data", "trip-planner.sqlite");
  mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);

  singleton = db;
  return db;
}

export function migrate(db: Database.Database): void {
  ensureItineraryItemsTable(db);
  migrateLegacySchedules(db);
  migrateLegacyRouteSegments(db);
  const schemaPath = path.join(process.cwd(), "src", "server", "schema.sql");
  db.exec(readFileSync(schemaPath, "utf8"));
  migrateLegacySchedules(db);
}

function ensureItineraryItemsTable(db: Database.Database): void {
  if (!tableExists(db, "places")) {
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS itinerary_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      visit_date TEXT,
      visit_time TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function migrateLegacySchedules(db: Database.Database): void {
  if (!tableExists(db, "places") || !tableExists(db, "itinerary_items")) {
    return;
  }

  const placeColumns = tableColumns(db, "places");
  if (!placeColumns.has("visit_date")) {
    return;
  }

  db.prepare(
    `INSERT INTO itinerary_items (place_id, visit_date, visit_time, notes, created_at, updated_at)
    SELECT
      places.id,
      places.visit_date,
      places.visit_time,
      NULL,
      places.created_at,
      places.updated_at
    FROM places
    WHERE places.visit_date IS NOT NULL
      AND NOT EXISTS (
      SELECT 1 FROM itinerary_items WHERE itinerary_items.place_id = places.id
    )`,
  ).run();
}

function migrateLegacyRouteSegments(db: Database.Database): void {
  if (!tableExists(db, "route_segments") || !tableExists(db, "itinerary_items")) {
    return;
  }

  const segmentColumns = tableColumns(db, "route_segments");
  if (!segmentColumns.has("from_place_id") || segmentColumns.has("from_item_id")) {
    return;
  }

  db.exec(`
    CREATE TABLE route_segments_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_item_id INTEGER NOT NULL REFERENCES itinerary_items(id) ON DELETE CASCADE,
      to_item_id INTEGER NOT NULL REFERENCES itinerary_items(id) ON DELETE CASCADE,
      mode TEXT NOT NULL DEFAULT 'walking' CHECK (mode IN ('walking', 'transit', 'bicycling', 'driving')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO route_segments_new (id, from_item_id, to_item_id, mode, created_at, updated_at)
    SELECT
      route_segments.id,
      from_items.item_id,
      to_items.item_id,
      route_segments.mode,
      route_segments.created_at,
      route_segments.updated_at
    FROM route_segments
    JOIN (
      SELECT place_id, MIN(id) AS item_id FROM itinerary_items GROUP BY place_id
    ) AS from_items ON from_items.place_id = route_segments.from_place_id
    JOIN (
      SELECT place_id, MIN(id) AS item_id FROM itinerary_items GROUP BY place_id
    ) AS to_items ON to_items.place_id = route_segments.to_place_id;

    DROP TABLE route_segments;
    ALTER TABLE route_segments_new RENAME TO route_segments;
    CREATE INDEX IF NOT EXISTS idx_route_segments_from_to ON route_segments (from_item_id, to_item_id);
  `);
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);

  return Boolean(row);
}

function tableColumns(db: Database.Database, tableName: string): Set<string> {
  return new Set(
    db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all()
      .map((row) => (row as { name: string }).name),
  );
}
