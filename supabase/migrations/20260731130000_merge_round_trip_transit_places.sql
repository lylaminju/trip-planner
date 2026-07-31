-- A round trip leaves from the stop it arrived at, so the trip stores an
-- arrival and a departure transit point naming the same place. The AI batch
-- writer materialized one place row per anchor, which listed that airport (or
-- station) twice in the trip's places list: two rows, same name, same
-- coordinates, one visit each.
--
-- The writer now reuses the arrival place for the round-trip departure, the way
-- a multi-night lodging is one place with a visit per day. This folds the
-- already-written duplicates onto the first of the pair and repoints their
-- itinerary items, so the visits survive as a second visit of the surviving
-- place.
--
-- Only AI-written places that match a trip's own round-trip stop by exact name
-- and coordinates are touched, and only those with no google_place_id, which is
-- what the anchor rows are written with. Hand-added places and catalog
-- candidates keep their own rows. The duplicates hold identical coordinates, so
-- repointed items keep their route segments and cached geometry.

drop table if exists round_trip_place_merge;
drop table if exists round_trip_place_remap;

-- 1. Places that stand for a trip's round-trip transit stop, keyed by the
--    surviving row: the first one written.
create temporary table round_trip_place_merge as
with round_trip_stop as (
  select
    arrival.trip_id,
    btrim(arrival.name) as name,
    arrival.latitude,
    arrival.longitude
  from public.trip_transit_points arrival
  join public.trip_transit_points departure
    on departure.trip_id = arrival.trip_id
   and departure.kind = 'departure'
   and btrim(departure.name) = btrim(arrival.name)
   and departure.latitude = arrival.latitude
   and departure.longitude = arrival.longitude
  where arrival.kind = 'arrival'
)
select
  p.id,
  min(p.id) over (
    partition by p.trip_id, stop.name, stop.latitude, stop.longitude
  ) as keep_id
from public.places p
join round_trip_stop stop
  on stop.trip_id = p.trip_id
 and stop.name = btrim(p.name)
 and stop.latitude = p.latitude
 and stop.longitude = p.longitude
where p.created_by_source = 'ai'
  and p.google_place_id is null;

create temporary table round_trip_place_remap as
select id as old_id, keep_id as new_id
from round_trip_place_merge
where id <> keep_id;

-- 2. Move the departure visit onto the surviving place before the duplicate is
--    deleted, so the cascade on places cannot take the visit with it.
update public.itinerary_items item
set place_id = remap.new_id, updated_at = now()
from round_trip_place_remap remap
where item.place_id = remap.old_id;

delete from public.places
where id in (select old_id from round_trip_place_remap);

drop table round_trip_place_merge;
drop table round_trip_place_remap;
