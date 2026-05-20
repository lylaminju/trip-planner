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
  const schemaPath = path.join(process.cwd(), "src", "server", "schema.sql");
  db.exec(readFileSync(schemaPath, "utf8"));
}
