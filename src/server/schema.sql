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
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS itinerary_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  visit_date TEXT,
  visit_time TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS route_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_item_id INTEGER NOT NULL REFERENCES itinerary_items(id) ON DELETE CASCADE,
  to_item_id INTEGER NOT NULL REFERENCES itinerary_items(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_itinerary_items_visit_date_time ON itinerary_items (visit_date, visit_time, place_id);
CREATE INDEX IF NOT EXISTS idx_route_segments_from_to ON route_segments (from_item_id, to_item_id);
CREATE INDEX IF NOT EXISTS idx_route_geometry_cache_places ON route_geometry_cache (from_place_id, to_place_id, mode);
