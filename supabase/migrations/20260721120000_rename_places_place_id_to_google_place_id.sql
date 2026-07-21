-- Rename places.place_id -> places.google_place_id so the column name states
-- that it holds a Google Places API place id, matching google_place_id on
-- ai_destination_candidates, trip_lodging, and trip_transit_points. The stored
-- values and type are unchanged; only the name moves. Guarded so it is a no-op
-- on databases already created from the current schema.sql.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'places'
      and column_name = 'place_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'places'
      and column_name = 'google_place_id'
  ) then
    alter table public.places rename column place_id to google_place_id;
  end if;
end $$;
