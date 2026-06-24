import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("supabase/schema.sql", "utf8");

describe("supabase route segment reconciliation schema", () => {
  it("stores nullable destination slugs and backfills exact curated matches", () => {
    expect(schema).toMatch(/destination_slug text/);
    expect(schema).toMatch(/add column if not exists destination_slug text/);
    expect(schema).toMatch(/destination_slug = curated_destinations\.slug/);
    expect(schema).toMatch(/where public\.trips\.destination_slug is null/);
    expect(schema).toContain("('toronto', 'Toronto')");
    expect(schema).toContain("('new-york-city', 'New York City')");
  });

  it("defines a transaction-scoped RPC for route reconciliation", () => {
    expect(schema).toMatch(
      /create or replace function public\.reconcile_route_segments_for_trip\(p_trip_id bigint\)/,
    );
    expect(schema).toMatch(/pg_advisory_xact_lock/);
    expect(schema).toMatch(/delete from public\.route_segments/);
    expect(schema).toMatch(/insert into public\.route_segments/);
  });

  it("enforces one route segment per trip item pair", () => {
    expect(schema).toMatch(
      /create unique index if not exists idx_route_segments_trip_pair_unique\s+on public\.route_segments \(trip_id, from_item_id, to_item_id\)/,
    );
  });

  it("limits the route reconciliation RPC to the service role", () => {
    expect(schema).toMatch(
      /revoke all on function public\.reconcile_route_segments_for_trip\(bigint\) from public/,
    );
    expect(schema).toMatch(
      /grant execute on function public\.reconcile_route_segments_for_trip\(bigint\) to service_role/,
    );
  });
});
