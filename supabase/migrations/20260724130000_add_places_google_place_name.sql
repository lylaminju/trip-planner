-- The place's canonical display name: Google's, from Place Details, an
-- autocomplete selection, or a resolved Maps link -- or a curated candidate's
-- seeded name. Never user-authored, whatever the source.
--
-- Deliberately separate from places.name, which is the user's own label and is
-- freely editable in the add/edit modal ("Meeting spot with Bob").
--
-- Map POI picks carry no name -- Google renders the POI card in a closed shadow
-- root, so it cannot be read from the DOM -- and resolving one costs a billed
-- Place Details Pro call. Storing the canonical name here lets a repeat pick of
-- an already-saved place reuse it for free. places.name can never serve that
-- purpose: the reuse lookup matches on google_place_id alone, with no trip or
-- account scope, so sharing a user-authored name would leak one person's
-- private label to everyone who clicks the same POI.
--
-- Null simply means "not known for free yet"; the next map-POI pick of that
-- place resolves and stores it.
alter table public.places
  add column if not exists google_place_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'places_google_place_name_not_blank'
      and conrelid = 'public.places'::regclass
  ) then
    alter table public.places
      add constraint places_google_place_name_not_blank
      check (google_place_name is null or btrim(google_place_name) <> '');
  end if;
end;
$$;

-- The reuse lookup filters on google_place_id and a non-null image; this keeps
-- that probe cheap as the table grows.
create index if not exists places_google_place_id_idx
  on public.places (google_place_id)
  where google_place_id is not null;

-- Backfill from curated candidates: the only canonical, non-user-authored name
-- already in this database.
--
-- places.name is deliberately NOT a source. It is editable in the modal at
-- create time, not just afterwards, so "never updated" would not imply "never
-- customized" -- and that signal does not exist anyway, since places has no
-- updated_at trigger and the update path never sets the column. A wrong value
-- here is served to other accounts by the reuse lookup and would be
-- indistinguishable from a correct one afterwards, so there would be no way to
-- find or repair it.
--
-- Copying the candidate's own name sidesteps all of that. Each user's label in
-- places.name is left untouched, including where it already differs from the
-- curated name. Rows with no matching candidate keep a null canonical name and
-- resolve it on the next pick. Idempotent: only fills rows still missing one.
update public.places p
set google_place_name = c.name
from (
  select distinct on (google_place_id) google_place_id, name
  from public.ai_destination_candidates
  where google_place_id is not null
    and btrim(name) <> ''
  order by google_place_id, id
) c
where p.google_place_id = c.google_place_id
  and p.google_place_name is null;
