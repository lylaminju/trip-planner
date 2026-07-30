-- Re-key route_geometry_cache by the route itself instead of by the place rows
-- that reference it. The old key was
--   from_place_id:to_place_id:mode:from_lat:from_lng:to_lat:to_lng
-- and places are per trip, so every trip paid again for geometry another trip
-- already had. The new key is
--   mode:from_lat:from_lng:to_lat:to_lng[:weekday-hour]
-- with the trailing departure bucket present only for transit.

-- Transit rows were all computed with no departureTime, which Google resolves to
-- the moment of the request: they describe "leaving now, whenever someone
-- browsed" rather than the trip's scheduled time. They cannot be assigned a
-- bucket after the fact, so they are dropped and refill against real departures.
delete from public.route_geometry_cache where mode = 'transit';

-- Collapse rows that differ only by place id, keeping the freshest.
with ranked as (
  select
    cache_key,
    row_number() over (
      partition by regexp_replace(cache_key, '^[^:]*:[^:]*:', '')
      order by updated_at desc, cache_key
    ) as duplicate_rank
  from public.route_geometry_cache
)
delete from public.route_geometry_cache c
using ranked
where c.cache_key = ranked.cache_key
  and ranked.duplicate_rank > 1;

update public.route_geometry_cache
set cache_key = regexp_replace(cache_key, '^[^:]*:[^:]*:', '');

-- Nothing queries the cache by place id. Dropping the columns below would remove
-- this index anyway; naming it keeps the change traceable against schema.sql.
drop index if exists public.idx_route_geometry_cache_places;

-- The place columns cannot survive a shared cache. Their foreign keys carry
-- ON DELETE CASCADE, so while a row belonged to one trip, deleting that trip's
-- place harmlessly deleted its geometry. Now that one row serves every trip
-- travelling the route, the same cascade would let one user's place removal wipe
-- geometry other trips are rendering. Dropping the columns drops those
-- constraints with them.
alter table public.route_geometry_cache
  drop column if exists from_place_id,
  drop column if exists to_place_id;
