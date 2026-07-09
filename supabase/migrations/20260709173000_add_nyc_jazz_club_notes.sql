alter table public.ai_destination_candidates
  add column if not exists planning_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_destination_candidates_planning_note_not_blank'
      and conrelid = 'public.ai_destination_candidates'::regclass
  ) then
    alter table public.ai_destination_candidates
      add constraint ai_destination_candidates_planning_note_not_blank
      check (planning_note is null or btrim(planning_note) <> '');
  end if;
end;
$$;

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
  indoor_outdoor,
  planning_note
)
values
  (
    'new-york-city',
    'Birdland Jazz Club',
    'jazz_club',
    array['landmarks', 'neighborhoods'],
    'Theater District',
    'central',
    31,
    40.75889,
    -73.98972,
    null,
    150,
    'indoor',
    'Online booking recommended.'
  ),
  (
    'new-york-city',
    'Blue Note Jazz Club',
    'jazz_club',
    array['landmarks', 'neighborhoods'],
    'Greenwich Village',
    'central',
    32,
    40.73088,
    -74.000702,
    null,
    150,
    'indoor',
    'Online booking recommended.'
  )
on conflict (destination_slug, lower(name))
do update set
  category = excluded.category,
  tags = excluded.tags,
  area = excluded.area,
  region_distance_tier = excluded.region_distance_tier,
  sort_order = excluded.sort_order,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  google_place_id = excluded.google_place_id,
  typical_duration_minutes = excluded.typical_duration_minutes,
  indoor_outdoor = excluded.indoor_outdoor,
  planning_note = excluded.planning_note,
  updated_at = now();

update public.ai_destination_candidates
set
  planning_note = 'Online booking recommended.',
  updated_at = now()
where destination_slug = 'new-york-city'
  and name = 'Village Vanguard';
