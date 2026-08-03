-- Adding a must-see candidate to a trip copies the candidate's photo URL onto
-- the place row, and that URL embeds the candidate's destination slug:
--
--   /storage/v1/object/public/candidate-images/{storage-safe slug}/{id}.{ext}
--
-- 20260731120000_merge_duplicate_ai_destination_catalogs moved every candidate
-- onto a merged slug and retired the duplicate rows, so the catalog's photos
-- were re-uploaded under the surviving slug and the objects behind the old
-- paths went away. The copies already stored on public.places still pointed at
-- those paths, and Storage answers them with "Object not found", which renders
-- as a broken thumbnail on the visit row rather than the placeholder glyph.
--
-- Repoint every stale copy at a photo that exists, preferring the exact image
-- the traveler saved:
--
--   1. the same file under the merged folder — the photo only moved,
--   2. the surviving candidate carrying the same Google place id,
--   3. the surviving candidate with the same name,
--   4. the nearest surviving candidate within the match radius, which recovers
--      the rows whose stored name drifted from the catalog's ("Getty Center"
--      against "The Getty Center").
--
-- Rules 2-4 adopt the candidate's attribution along with its photo, and the
-- closest candidate wins wherever a rule matches more than one. A place that
-- matches nothing is cleared to null so it falls back to the placeholder
-- instead of a broken image.
--
-- Object existence is read from storage.objects rather than assumed, so the
-- migration only touches rows that are actually broken and is re-runnable.

drop table if exists place_image_repair;

create temporary table place_image_repair as
with bucket(object_prefix) as (
  values ('/storage/v1/object/public/candidate-images/')
),
match_settings(earth_radius_m, match_radius_m) as (
  -- Wide enough to cover a landmark's own footprint, tight enough that a
  -- neighbouring entry in the same catalog cannot be adopted by mistake.
  values (6371000::double precision, 250::double precision)
),
retired_folder(retired, merged) as (
  -- Storage-safe forms of the slugs 20260731120000 merged away: the uploader
  -- replaces every run of characters outside [a-zA-Z0-9-] with a dash.
  values
    ('custom-us-los-angeles-34-1--118-2', 'los-angeles'),
    ('custom-xx-los-angeles-34-1--118-2', 'los-angeles'),
    ('custom-ca-halifax-44-7--63-6', 'custom-halifax-44-7--63-6'),
    ('custom-jp-fukuoka-33-6-130-4', 'custom-fukuoka-33-6-130-4'),
    ('custom-my-kota-kinabalu-6-0-116-1', 'custom-kota-kinabalu-6-0-116-1')
),
stored as (
  select
    p.id,
    p.name,
    p.google_place_id,
    p.latitude,
    p.longitude,
    p.image_url,
    p.image_credit,
    split_part(p.image_url, bucket.object_prefix, 2) as object_path
  from public.places p
  cross join bucket
  where position(bucket.object_prefix in p.image_url) > 0
),
stale_photo as (
  select
    stored.*,
    split_part(stored.object_path, '/', 1) as folder,
    split_part(stored.object_path, '/', 2) as file_name,
    coalesce(
      retired_folder.merged,
      split_part(stored.object_path, '/', 1)
    ) as folder_now
  from stored
  left join retired_folder
    on retired_folder.retired = split_part(stored.object_path, '/', 1)
  where not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'candidate-images'
      and o.name = stored.object_path
  )
),
live_candidate as (
  select
    c.name,
    c.google_place_id,
    c.latitude,
    c.longitude,
    c.image_url,
    c.image_credit,
    regexp_replace(c.destination_slug, '[^a-zA-Z0-9-]+', '-', 'g') as folder
  from public.ai_destination_candidates c
  cross join bucket
  where c.image_url is not null
    and exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'candidate-images'
        and o.name = split_part(c.image_url, bucket.object_prefix, 2)
    )
),
catalog_match as (
  -- Every photo still reachable in the catalog a broken place drew from,
  -- paired with that place and the distance between the two.
  select
    stale_photo.id as place_id,
    stale_photo.name as place_name,
    stale_photo.google_place_id as place_google_place_id,
    live_candidate.name,
    live_candidate.google_place_id,
    live_candidate.image_url,
    live_candidate.image_credit,
    2 * match_settings.earth_radius_m * asin(sqrt(least(1,
      power(sin(radians(
        (live_candidate.latitude - stale_photo.latitude) / 2
      )), 2)
        + cos(radians(stale_photo.latitude))
          * cos(radians(live_candidate.latitude))
          * power(sin(radians(
              (live_candidate.longitude - stale_photo.longitude) / 2
            )), 2)
    ))) as metres
  from stale_photo
  join live_candidate on live_candidate.folder = stale_photo.folder_now
  cross join match_settings
),
replacement as (
  select
    stale_photo.id as place_id,
    1 as rule,
    replace(
      stale_photo.image_url,
      '/candidate-images/' || stale_photo.folder || '/',
      '/candidate-images/' || stale_photo.folder_now || '/'
    ) as image_url,
    stale_photo.image_credit as image_credit,
    0::double precision as metres
  from stale_photo
  where exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'candidate-images'
      and o.name = stale_photo.folder_now || '/' || stale_photo.file_name
  )

  union all

  select place_id, 2, image_url, image_credit, metres
  from catalog_match
  where google_place_id is not null
    and google_place_id = place_google_place_id

  union all

  select place_id, 3, image_url, image_credit, metres
  from catalog_match
  where lower(btrim(name)) = lower(btrim(place_name))

  union all

  select place_id, 4, image_url, image_credit, metres
  from catalog_match
  cross join match_settings
  where metres <= match_settings.match_radius_m
),
best_replacement as (
  select distinct on (place_id)
    place_id, rule, image_url, image_credit, metres
  from replacement
  order by place_id, rule, metres, image_url
)
select
  stale_photo.id,
  best_replacement.rule,
  best_replacement.image_url,
  best_replacement.image_credit
from stale_photo
left join best_replacement on best_replacement.place_id = stale_photo.id;

update public.places p
set
  image_url = repair.image_url,
  image_credit = repair.image_credit,
  updated_at = now()
from place_image_repair repair
where repair.id = p.id
  and (
    p.image_url is distinct from repair.image_url
    or p.image_credit is distinct from repair.image_credit
  );

drop table place_image_repair;
