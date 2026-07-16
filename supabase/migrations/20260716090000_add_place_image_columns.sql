-- Persist AI candidate imagery on places so planner visit rows and the map
-- card can show thumbnails. Values are copied from ai_destination_candidates
-- when an AI plan is applied; manually created places keep null.
alter table public.places
  add column if not exists image_url text;

alter table public.places
  add column if not exists image_credit text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'places_image_url_not_blank'
      and conrelid = 'public.places'::regclass
  ) then
    alter table public.places
      add constraint places_image_url_not_blank
      check (image_url is null or btrim(image_url) <> '');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'places_image_credit_not_blank'
      and conrelid = 'public.places'::regclass
  ) then
    alter table public.places
      add constraint places_image_credit_not_blank
      check (image_credit is null or btrim(image_credit) <> '');
  end if;
end;
$$;

-- Backfill existing AI-generated places from the candidate catalog. Matches by
-- Google place id first, then by name within the trip's destination so that
-- same-named places in other destinations cannot cross-match. Idempotent: only
-- fills rows that are still missing an image and never overwrites user edits.
update public.places p
set
  image_url = c.image_url,
  image_credit = c.image_credit
from
  public.ai_destination_candidates c,
  public.trips t
where t.id = p.trip_id
  and p.created_by_source = 'ai'
  and p.image_url is null
  and c.image_url is not null
  and (
    (p.place_id is not null and p.place_id = c.google_place_id)
    or (
      p.place_id is null
      and t.destination_slug = c.destination_slug
      and p.name = c.name
    )
  );
