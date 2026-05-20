import type Database from "better-sqlite3";

import type { Place, RouteSegment, TravelMode } from "@/lib/types";
import { PlaceNotFoundError, RouteSegmentNotFoundError } from "@/server/errors";

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
  visit_date: string | null;
  visit_time: string | null;
  notes: string | null;
};

export type PlaceUpdate = Partial<
  Omit<PlaceInsert, "place_id" | "google_place_token" | "google_internal_ids" | "source_list_url">
> & {
  place_id?: string | null;
  google_place_token?: string | null;
  google_internal_ids?: string | null;
  source_list_url?: string | null;
};

type RouteSegmentInsert = {
  from_place_id: number;
  to_place_id: number;
  mode: TravelMode;
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
  "visit_date",
  "visit_time",
  "notes",
] as const satisfies readonly (keyof PlaceUpdate)[];

export function listPlaces(db: Database.Database): Place[] {
  return db
    .prepare("SELECT * FROM places ORDER BY COALESCE(visit_date, ''), COALESCE(visit_time, ''), name")
    .all() as Place[];
}

export function listRouteSegments(db: Database.Database): RouteSegment[] {
  return db.prepare("SELECT * FROM route_segments ORDER BY id").all() as RouteSegment[];
}

export function insertPlace(db: Database.Database, input: PlaceInsert): Place {
  const result = db
    .prepare(
      `INSERT INTO places (
        name, address, google_maps_url, place_id, google_place_token, google_internal_ids, source_list_url,
        latitude, longitude, visit_date, visit_time, notes
      ) VALUES (
        @name, @address, @google_maps_url, @place_id, @google_place_token, @google_internal_ids, @source_list_url,
        @latitude, @longitude, @visit_date, @visit_time, @notes
      )`,
    )
    .run(input);

  return getPlace(db, Number(result.lastInsertRowid));
}

export function getPlaceById(db: Database.Database, id: number): Place {
  return getPlace(db, id);
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

export function deletePlace(db: Database.Database, id: number): void {
  const result = db.prepare("DELETE FROM places WHERE id = ?").run(id);
  if (result.changes === 0) {
    throw new PlaceNotFoundError(id);
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
    "INSERT INTO route_segments (from_place_id, to_place_id, mode) VALUES (@from_place_id, @to_place_id, @mode)",
  );

  for (const id of deleteIds) deleteStatement.run(id);
  for (const insert of inserts) insertStatement.run(insert);
}

export function replaceSegmentsAtomic(
  db: Database.Database,
  deleteIds: number[],
  inserts: RouteSegmentInsert[],
): void {
  const replaceSegmentsTransaction = db.transaction(
    (transactionDeleteIds: number[], transactionInserts: RouteSegmentInsert[]) => {
      replaceSegments(db, transactionDeleteIds, transactionInserts);
    },
  );

  replaceSegmentsTransaction(deleteIds, inserts);
}

function getPlace(db: Database.Database, id: number): Place {
  const place = db.prepare("SELECT * FROM places WHERE id = ?").get(id) as Place | undefined;
  if (!place) throw new PlaceNotFoundError(id);
  return place;
}
