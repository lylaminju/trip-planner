-- Emoji shown in a place's thumbnail when it has no photo. Set for AI-generated
-- anchor places -- arrival/departure transit hubs (by hub type) and lodging --
-- which never resolve a photo; every other place stays null and keeps using the
-- name's leading character as its monogram fallback.
alter table public.places
  add column if not exists fallback_emoji text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'places_fallback_emoji_not_blank'
      and conrelid = 'public.places'::regclass
  ) then
    alter table public.places
      add constraint places_fallback_emoji_not_blank
      check (fallback_emoji is null or btrim(fallback_emoji) <> '');
  end if;
end;
$$;

-- Backfill previously generated anchor places. Anchor rows copied their name and
-- coordinates verbatim from the trip's transit points and lodging, so match on
-- those. Idempotent: only fills rows still missing an emoji, never overwrites.
-- The hub-type emojis here mirror src/lib/place-fallback-emoji.ts.
update public.places p
set fallback_emoji = case tp.hub_type
    when 'airport' then '✈️'
    when 'train_station' then '🚆'
    when 'bus_terminal' then '🚌'
    when 'ferry_terminal' then '⛴️'
  end
from public.trip_transit_points tp
where p.trip_id = tp.trip_id
  and p.name = tp.name
  and p.latitude = tp.latitude
  and p.longitude = tp.longitude
  and p.created_by_source = 'ai'
  and p.fallback_emoji is null
  and tp.hub_type is not null;

update public.places p
set fallback_emoji = '🏨'
from public.trip_lodgings tl
where p.trip_id = tl.trip_id
  and p.name = tl.name
  and p.latitude = tl.latitude
  and p.longitude = tl.longitude
  and p.created_by_source = 'ai'
  and p.fallback_emoji is null;
