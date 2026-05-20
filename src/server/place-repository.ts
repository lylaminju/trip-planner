import type Database from "better-sqlite3";

import type { ItineraryItem, Place, RouteSegment, TravelMode } from "@/lib/types";
import {
  ItineraryItemNotFoundError,
  PlaceNotFoundError,
  RouteSegmentNotFoundError,
} from "@/server/errors";

export type PlaceInsert = {
  name: string;
  address: string | null;
  google_maps_url: string;
  place_id: string | null;
  google_place_token: string | null;
  google_internal_ids: string | null;
  source_list_url: string | null;
  latitude: number;
  longitude: number;
  notes: string | null;
  visit_date?: string | null;
  visit_time?: string | null;
};

export type PlaceUpdate = Partial<PlaceInsert>;

export type ItineraryItemInsert = {
  place_id: number;
  visit_date: string | null;
  visit_time: string | null;
  notes: string | null;
};

export type ItineraryItemUpdate = Partial<Omit<ItineraryItemInsert, "place_id">>;

type RouteSegmentInsert = {
  from_item_id: number;
  to_item_id: number;
  mode: TravelMode;
};

type ItineraryItemRow = {
  item_id: number;
  item_place_id: number;
  item_visit_date: string | null;
  item_visit_time: string | null;
  item_notes: string | null;
  item_created_at: string;
  item_updated_at: string;
  place_id: number;
  name: string;
  address: string | null;
  google_maps_url: string;
  place_id_external: string | null;
  google_place_token: string | null;
  google_internal_ids: string | null;
  source_list_url: string | null;
  latitude: number;
  longitude: number;
  place_notes: string | null;
  place_created_at: string;
  place_updated_at: string;
};

const PLACE_UPDATE_COLUMNS = [
  "name",
  "address",
  "google_maps_url",
  "place_id",
  "google_place_token",
  "google_internal_ids",
  "source_list_url",
  "latitude",
  "longitude",
  "notes",
] as const satisfies readonly (keyof PlaceUpdate)[];

const ITEM_UPDATE_COLUMNS = ["visit_date", "visit_time", "notes"] as const satisfies readonly (keyof ItineraryItemUpdate)[];

export function listPlaces(db: Database.Database): Place[] {
  return db.prepare("SELECT * FROM places ORDER BY name").all() as Place[];
}

export function listItineraryItems(db: Database.Database): ItineraryItem[] {
  return (db
    .prepare(
      `SELECT
        itinerary_items.id AS item_id,
        itinerary_items.place_id AS item_place_id,
        itinerary_items.visit_date AS item_visit_date,
        itinerary_items.visit_time AS item_visit_time,
        itinerary_items.notes AS item_notes,
        itinerary_items.created_at AS item_created_at,
        itinerary_items.updated_at AS item_updated_at,
        places.id AS place_id,
        places.name,
        places.address,
        places.google_maps_url,
        places.place_id AS place_id_external,
        places.google_place_token,
        places.google_internal_ids,
        places.source_list_url,
        places.latitude,
        places.longitude,
        places.notes AS place_notes,
        places.created_at AS place_created_at,
        places.updated_at AS place_updated_at
      FROM itinerary_items
      JOIN places ON places.id = itinerary_items.place_id
      ORDER BY COALESCE(itinerary_items.visit_date, ''), COALESCE(itinerary_items.visit_time, ''), places.name`,
    )
    .all() as ItineraryItemRow[]).map(toItineraryItem);
}

export function listItineraryItemsByPlaceId(db: Database.Database, placeId: number): ItineraryItem[] {
  return (db
    .prepare(
      `${ITINERARY_ITEM_SELECT}
      WHERE itinerary_items.place_id = ?
      ORDER BY itinerary_items.id`,
    )
    .all(placeId) as ItineraryItemRow[]).map(toItineraryItem);
}

export function listRouteSegments(db: Database.Database): RouteSegment[] {
  return db.prepare("SELECT * FROM route_segments ORDER BY id").all() as RouteSegment[];
}

export function insertPlace(db: Database.Database, input: PlaceInsert): Place {
  const result = db
    .prepare(
      `INSERT INTO places (
        name, address, google_maps_url, place_id, google_place_token, google_internal_ids, source_list_url,
        latitude, longitude, notes
      ) VALUES (
        @name, @address, @google_maps_url, @place_id, @google_place_token, @google_internal_ids, @source_list_url,
        @latitude, @longitude, @notes
      )`,
    )
    .run(input);

  return getPlace(db, Number(result.lastInsertRowid));
}

export function insertItineraryItem(db: Database.Database, input: ItineraryItemInsert): ItineraryItem {
  const result = db
    .prepare(
      `INSERT INTO itinerary_items (place_id, visit_date, visit_time, notes)
      VALUES (@place_id, @visit_date, @visit_time, @notes)`,
    )
    .run(input);

  return getItineraryItem(db, Number(result.lastInsertRowid));
}

export function getPlaceById(db: Database.Database, id: number): Place {
  return getPlace(db, id);
}

export function getItineraryItemById(db: Database.Database, id: number): ItineraryItem {
  return getItineraryItem(db, id);
}

export function updatePlace(db: Database.Database, id: number, input: PlaceUpdate): Place {
  const fields = PLACE_UPDATE_COLUMNS.filter((key) => input[key] !== undefined);
  if (fields.length === 0) return getPlace(db, id);

  const assignments = fields.map((key) => `${key} = @${key}`).join(", ");
  const params: Record<string, number | string | null> = { id };
  for (const key of fields) {
    params[key] = input[key] ?? null;
  }

  db.prepare(`UPDATE places SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`).run(params);
  return getPlace(db, id);
}

export function updateItineraryItem(
  db: Database.Database,
  id: number,
  input: ItineraryItemUpdate,
): ItineraryItem {
  const fields = ITEM_UPDATE_COLUMNS.filter((key) => input[key] !== undefined);
  if (fields.length === 0) return getItineraryItem(db, id);

  const assignments = fields.map((key) => `${key} = @${key}`).join(", ");
  const params: Record<string, number | string | null> = { id };
  for (const key of fields) {
    params[key] = input[key] ?? null;
  }

  db.prepare(`UPDATE itinerary_items SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`).run(params);
  return getItineraryItem(db, id);
}

export function deletePlace(db: Database.Database, id: number): void {
  const result = db.prepare("DELETE FROM places WHERE id = ?").run(id);
  if (result.changes === 0) {
    throw new PlaceNotFoundError(id);
  }
}

export function deleteItineraryItem(db: Database.Database, id: number): void {
  const result = db.prepare("DELETE FROM itinerary_items WHERE id = ?").run(id);
  if (result.changes === 0) {
    throw new ItineraryItemNotFoundError(id);
  }
}

export function updateRouteSegmentMode(
  db: Database.Database,
  id: number,
  mode: TravelMode,
): RouteSegment {
  db.prepare("UPDATE route_segments SET mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(mode, id);
  const segment = db.prepare("SELECT * FROM route_segments WHERE id = ?").get(id) as
    | RouteSegment
    | undefined;
  if (!segment) throw new RouteSegmentNotFoundError(id);
  return segment;
}

export function replaceSegments(
  db: Database.Database,
  deleteIds: number[],
  inserts: RouteSegmentInsert[],
): void {
  const deleteStatement = db.prepare("DELETE FROM route_segments WHERE id = ?");
  const insertStatement = db.prepare(
    "INSERT INTO route_segments (from_item_id, to_item_id, mode) VALUES (@from_item_id, @to_item_id, @mode)",
  );

  for (const id of deleteIds) deleteStatement.run(id);
  for (const insert of inserts) insertStatement.run(insert);
}

function getPlace(db: Database.Database, id: number): Place {
  const place = db.prepare("SELECT * FROM places WHERE id = ?").get(id) as Place | undefined;
  if (!place) throw new PlaceNotFoundError(id);
  return place;
}

function getItineraryItem(db: Database.Database, id: number): ItineraryItem {
  const row = db
    .prepare(
      `${ITINERARY_ITEM_SELECT}
      WHERE itinerary_items.id = ?`,
    )
    .get(id) as ItineraryItemRow | undefined;

  if (!row) throw new ItineraryItemNotFoundError(id);
  return toItineraryItem(row);
}

const ITINERARY_ITEM_SELECT = `SELECT
  itinerary_items.id AS item_id,
  itinerary_items.place_id AS item_place_id,
  itinerary_items.visit_date AS item_visit_date,
  itinerary_items.visit_time AS item_visit_time,
  itinerary_items.notes AS item_notes,
  itinerary_items.created_at AS item_created_at,
  itinerary_items.updated_at AS item_updated_at,
  places.id AS place_id,
  places.name,
  places.address,
  places.google_maps_url,
  places.place_id AS place_id_external,
  places.google_place_token,
  places.google_internal_ids,
  places.source_list_url,
  places.latitude,
  places.longitude,
  places.notes AS place_notes,
  places.created_at AS place_created_at,
  places.updated_at AS place_updated_at
FROM itinerary_items
JOIN places ON places.id = itinerary_items.place_id`;

function toItineraryItem(row: ItineraryItemRow): ItineraryItem {
  return {
    id: row.item_id,
    place_id: row.item_place_id,
    visit_date: row.item_visit_date,
    visit_time: row.item_visit_time,
    notes: row.item_notes,
    created_at: row.item_created_at,
    updated_at: row.item_updated_at,
    place: {
      id: row.place_id,
      name: row.name,
      address: row.address,
      google_maps_url: row.google_maps_url,
      place_id: row.place_id_external,
      google_place_token: row.google_place_token,
      google_internal_ids: row.google_internal_ids,
      source_list_url: row.source_list_url,
      latitude: row.latitude,
      longitude: row.longitude,
      notes: row.place_notes,
      created_at: row.place_created_at,
      updated_at: row.place_updated_at,
    },
  };
}
