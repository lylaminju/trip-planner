import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { migrate } from "@/server/db";

describe("database migrations", () => {
  it("preserves legacy place schedules before converting route segments to itinerary items", () => {
    const db = new Database(":memory:");
    db.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE places (
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

      CREATE TABLE route_segments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
        to_place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
        mode TEXT NOT NULL DEFAULT 'walking',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO places (id, name, google_maps_url, latitude, longitude, visit_date, visit_time)
      VALUES
        (1, 'Hotel', 'https://www.google.com/maps', 40.7, -73.9, '2026-06-01', '09:00'),
        (2, 'Museum', 'https://www.google.com/maps', 40.8, -74.0, '2026-06-01', '10:00');

      INSERT INTO route_segments (id, from_place_id, to_place_id, mode)
      VALUES (7, 1, 2, 'transit');
    `);

    migrate(db);

    const items = db
      .prepare("SELECT id, place_id, visit_date, visit_time FROM itinerary_items ORDER BY id")
      .all();
    const segments = db.prepare("SELECT id, from_item_id, to_item_id, mode FROM route_segments").all();

    expect(items).toEqual([
      { id: 1, place_id: 1, visit_date: "2026-06-01", visit_time: "09:00" },
      { id: 2, place_id: 2, visit_date: "2026-06-01", visit_time: "10:00" },
    ]);
    expect(segments).toEqual([{ id: 7, from_item_id: 1, to_item_id: 2, mode: "transit" }]);
  });
});
