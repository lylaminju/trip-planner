-- Curate the Toronto catalog's shopping options.
--
-- Yorkville is the weakest row in the destination: it is the only Toronto
-- candidate Wikimedia could not source a blurb for, and its thumbnail fell back
-- to a Google Maps street photo, which reads as a generic streetscape rather
-- than a place worth a slot in a day plan. Neighbourhood candidates photograph
-- badly in general, and Bloor-Yorkville is already represented by the Royal
-- Ontario Museum and the Gardiner Museum.
--
-- CF Toronto Eaton Centre takes over as the destination's shopping anchor and
-- is the catalog's only indoor retail option, so a rainy day still has one.
-- Distillery District and Kensington Market keep the `shopping` tag they were
-- given in 20260714120000.
--
-- google_place_id, image_url, and blurb are left null for the new row; the
-- existing backfill scripts fill them.

insert into public.ai_destination_candidates (
  destination_slug,
  name,
  category,
  tags,
  area,
  region_distance_tier,
  sort_order,
  latitude,
  longitude,
  google_place_id,
  typical_duration_minutes,
  indoor_outdoor
)
select
  'toronto',
  'CF Toronto Eaton Centre',
  'shopping_mall',
  array['shopping'],
  'Downtown',
  'central',
  -- Appended to the end of the catalog. Taken from the current maximum rather
  -- than hardcoded because the planner also inserts generated candidates
  -- against this slug, and (destination_slug, sort_order) is unique.
  coalesce(max(sort_order), 0) + 1,
  43.6544,
  -79.3807,
  null,
  90,
  'indoor'
from public.ai_destination_candidates
where destination_slug = 'toronto'
on conflict (destination_slug, lower(name))
do update set
  category = excluded.category,
  tags = excluded.tags,
  area = excluded.area,
  region_distance_tier = excluded.region_distance_tier,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  typical_duration_minutes = excluded.typical_duration_minutes,
  indoor_outdoor = excluded.indoor_outdoor,
  updated_at = now();

-- Drop Yorkville and, in the same statement, strip its id from any trip that
-- had picked it as a must-see. must_see_candidate_ids is a plain bigint[] with
-- no foreign key, so a delete alone would leave the id dangling and the wizard
-- would render a selection that no longer resolves to a candidate.
--
-- Places already saved from this candidate keep their copied image_url: the
-- storage object under candidate-images/toronto/ is not removed here, so those
-- thumbnails stay reachable.
with removed as (
  delete from public.ai_destination_candidates
  where destination_slug = 'toronto'
    and lower(name) = 'yorkville'
  returning id
)
update public.ai_planning_preferences pref
set
  must_see_candidate_ids = array(
    select selection.candidate_id
    from unnest(pref.must_see_candidate_ids)
      with ordinality as selection(candidate_id, selected_at)
    where selection.candidate_id not in (select id from removed)
    order by selection.selected_at
  ),
  updated_at = now()
where exists (
  select 1
  from removed
  where removed.id = any(pref.must_see_candidate_ids)
);
