-- The AI catalog key used to fold the trip's country code into the slug and to
-- substitute placeholder segments for missing metadata ("xx" for an unresolved
-- country, "na" for missing coordinates). One destination therefore split
-- across several catalogs depending only on which metadata happened to be
-- resolved when each catalog was first generated:
--
--   los-angeles                        curated preset   30 rows
--   custom-xx-los-angeles-34.1,-118.2  no country code  39 rows
--   custom-us-los-angeles-34.1,-118.2  country code     40 rows
--   custom-xx-halifax-na               no geo at all    38 rows
--   custom-ca-halifax-44.7,-63.6       full geo         39 rows
--
-- destinationCandidateKey now keys on coordinates alone, so surviving custom
-- slugs also drop their country segment.
--
-- Each destination's catalogs are unioned onto one slug rather than having the
-- smaller ones deleted: a row is only removed when an equivalent row survives
-- for the same place, so every selection stored in
-- ai_planning_preferences.must_see_candidate_ids can be repointed and none is
-- lost. Surviving rows keep their id (moved with update, never re-inserted)
-- for the same reason.
--
-- Rows are matched as the same place by Google place id, falling back to an
-- exact name match. A row with no place id inherits one from a same-named row
-- that has it, so the two representations of a place still collapse.
--
-- The same matching also runs over the catalogs that have nothing to union
-- with (Fukuoka, Kota Kinabalu), because a single catalog can hold several
-- rows for one place: "Mari Mari Cultural Village" and "Mari-Mari Cultural
-- Village" share a place id but differ as text, so the unique index on
-- (destination_slug, lower(name)) never rejected them.

drop table if exists ai_catalog_merge;
drop table if exists ai_catalog_winner;
drop table if exists ai_catalog_remap;
drop table if exists ai_hub_merge;
drop table if exists ai_hub_winner;

-- 1. Every row taking part in a merge, tagged with its target catalog, the
--    preference order of its source catalog, and its dedup key. Priority 1 is
--    the catalog whose rows win ties, so the merged catalog keeps the largest
--    source's naming and ordering as its spine.
create temporary table ai_catalog_merge as
with merge_source(source_slug, target_slug, priority) as (
  values
    ('custom-us-los-angeles-34.1,-118.2', 'los-angeles', 1),
    ('custom-xx-los-angeles-34.1,-118.2', 'los-angeles', 2),
    ('los-angeles', 'los-angeles', 3),
    ('custom-ca-halifax-44.7,-63.6', 'custom-halifax-44.7,-63.6', 1),
    ('custom-xx-halifax-na', 'custom-halifax-44.7,-63.6', 2),
    -- Single-source groups: no second catalog to union, but the same dedup
    -- collapses the duplicate rows within them and renames the slug.
    ('custom-jp-fukuoka-33.6,130.4', 'custom-fukuoka-33.6,130.4', 1),
    ('custom-my-kota-kinabalu-6.0,116.1', 'custom-kota-kinabalu-6.0,116.1', 1)
),
name_place_id as (
  select
    m.target_slug,
    lower(btrim(c.name)) as match_name,
    min(c.google_place_id) as google_place_id
  from public.ai_destination_candidates c
  join merge_source m on m.source_slug = c.destination_slug
  where c.google_place_id is not null
  group by 1, 2
)
select
  c.id,
  m.target_slug,
  m.priority,
  c.sort_order,
  c.google_place_id,
  c.image_url,
  c.blurb,
  coalesce(
    c.google_place_id,
    npi.google_place_id,
    'name:' || lower(btrim(c.name))
  ) as dedup_key
from public.ai_destination_candidates c
join merge_source m on m.source_slug = c.destination_slug
left join name_place_id npi
  on npi.target_slug = m.target_slug
 and npi.match_name = lower(btrim(c.name));

-- 2. One surviving row per place, preferring the most complete record so the
--    merged catalog keeps its previews and descriptions.
create temporary table ai_catalog_winner as
select distinct on (target_slug, dedup_key)
  id, target_slug, priority, sort_order, dedup_key,
  -- carried so every order by expression below is also selected
  image_url, blurb, google_place_id
from ai_catalog_merge
order by
  target_slug,
  dedup_key,
  (image_url is not null) desc,
  (blurb is not null) desc,
  (google_place_id is not null) desc,
  priority,
  id;

create temporary table ai_catalog_remap as
select merged.id as old_id, winner.id as new_id
from ai_catalog_merge merged
join ai_catalog_winner winner
  on winner.target_slug = merged.target_slug
 and winner.dedup_key = merged.dedup_key
where merged.id <> winner.id;

-- 3. Repoint stored must-see selections onto the surviving row. Every retired
--    row has a winner by construction, so no selection is dropped.
update public.ai_planning_preferences pref
set must_see_candidate_ids = rewritten.must_see_candidate_ids
from (
  select
    inner_pref.trip_id,
    coalesce(
      array_agg(
        distinct coalesce(remap.new_id, selection.candidate_id)
        order by coalesce(remap.new_id, selection.candidate_id)
      ),
      '{}'::bigint[]
    ) as must_see_candidate_ids
  from public.ai_planning_preferences inner_pref
  cross join lateral unnest(inner_pref.must_see_candidate_ids)
    as selection(candidate_id)
  left join ai_catalog_remap remap on remap.old_id = selection.candidate_id
  group by inner_pref.trip_id
) rewritten
where rewritten.trip_id = pref.trip_id
  and rewritten.must_see_candidate_ids is distinct from pref.must_see_candidate_ids;

-- 4. Drop the now-redundant rows and move the survivors onto the target slug.
delete from public.ai_destination_candidates
where id in (select old_id from ai_catalog_remap);

-- The union renumbers sort_order, which is unique per slug. Rows are parked
-- above every real sort_order first so no intermediate state collides; the
-- offset is larger than any catalog will ever be.
update public.ai_destination_candidates c
set
  destination_slug = sequenced.target_slug,
  sort_order = 100000 + sequenced.position,
  updated_at = now()
from (
  select
    winner.id,
    winner.target_slug,
    row_number() over (
      partition by winner.target_slug
      order by winner.priority, winner.sort_order, winner.id
    ) as position
  from ai_catalog_winner winner
) sequenced
where c.id = sequenced.id;

update public.ai_destination_candidates
set sort_order = sort_order - 100000
where sort_order > 100000;

-- 5. Merge the destinations' transit hubs the same way, matched on name.
create temporary table ai_hub_merge as
select
  h.id,
  m.target_slug,
  m.priority,
  h.sort_order,
  lower(btrim(h.name)) as dedup_key
from public.ai_destination_transit_hubs h
join (values
  ('custom-us-los-angeles-34.1,-118.2', 'los-angeles', 1),
  ('custom-xx-los-angeles-34.1,-118.2', 'los-angeles', 2),
  ('los-angeles', 'los-angeles', 3),
  ('custom-ca-halifax-44.7,-63.6', 'custom-halifax-44.7,-63.6', 1),
  ('custom-xx-halifax-na', 'custom-halifax-44.7,-63.6', 2),
  ('custom-jp-fukuoka-33.6,130.4', 'custom-fukuoka-33.6,130.4', 1),
  ('custom-my-kota-kinabalu-6.0,116.1', 'custom-kota-kinabalu-6.0,116.1', 1)
) as m(source_slug, target_slug, priority)
  on m.source_slug = h.destination_slug;

create temporary table ai_hub_winner as
select distinct on (target_slug, dedup_key)
  id, target_slug, priority, sort_order, dedup_key
from ai_hub_merge
order by target_slug, dedup_key, priority, id;

delete from public.ai_destination_transit_hubs
where id in (select id from ai_hub_merge)
  and id not in (select id from ai_hub_winner);

update public.ai_destination_transit_hubs h
set
  destination_slug = sequenced.target_slug,
  sort_order = 100000 + sequenced.position,
  updated_at = now()
from (
  select
    winner.id,
    winner.target_slug,
    row_number() over (
      partition by winner.target_slug
      order by winner.priority, winner.sort_order, winner.id
    ) as position
  from ai_hub_winner winner
) sequenced
where h.id = sequenced.id;

update public.ai_destination_transit_hubs
set sort_order = sort_order - 100000
where sort_order > 100000;

-- 6. Point the custom Los Angeles trips at the curated preset so every Los
--    Angeles trip resolves to the one merged catalog. Los Angeles keeps the
--    preset slug because guests reach it by that slug and cannot generate a
--    catalog themselves.
update public.trips
set destination = 'Los Angeles', destination_slug = 'los-angeles'
where destination_slug is null
  and lower(btrim(destination)) = 'los angeles';

-- 7. Backfill the trips that carry no coordinates. Without them these trips
--    can no longer resolve a catalog key at all, and the placeholder keys they
--    used to mint are exactly what this migration is undoing.

-- Iceland is a curated preset, so this trip joins the existing seeded catalog.
update public.trips
set
  destination = 'Iceland',
  destination_slug = 'iceland',
  destination_latitude = 64.9631,
  destination_longitude = -19.0208,
  destination_country_codes = array['IS']
where destination_slug is null
  and lower(btrim(destination)) = 'iceland'
  and destination_latitude is null;

-- Halifax: the coordinates already stored on the other Halifax trip, so both
-- share the merged custom-halifax-44.7,-63.6 catalog.
update public.trips
set
  destination_latitude = 44.6508608,
  destination_longitude = -63.5923256,
  destination_country_codes = array['CA']
where destination_slug is null
  and lower(btrim(destination)) = 'halifax'
  and destination_latitude is null;

-- Yakushima: the coordinates already stored on the other Yakushima trips,
-- which the country code previously split into two would-be catalogs.
update public.trips
set
  destination = 'Yakushima Island',
  destination_latitude = 30.3445936,
  destination_longitude = 130.5127142,
  destination_country_codes = array['JP']
where destination_slug is null
  and lower(btrim(destination)) = 'yakushima'
  and destination_latitude is null;

-- Iguazu Falls, keyed to the Argentine side where the main viewpoints sit.
update public.trips
set
  destination = 'Iguazu Falls',
  destination_latitude = -25.6953,
  destination_longitude = -54.4367,
  destination_country_codes = array['AR']
where destination_slug is null
  and lower(btrim(destination)) = 'iguasu waterfall'
  and destination_latitude is null;

drop table ai_catalog_merge;
drop table ai_catalog_winner;
drop table ai_catalog_remap;
drop table ai_hub_merge;
drop table ai_hub_winner;
