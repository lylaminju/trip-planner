-- Internal guests: guest cookie UUIDs belonging to the developer's own
-- browsers. Their rows stay in guest_events / guest_api_usage / trips, but
-- guest activity analytics exclude them so dashboards reflect real guests.

create table if not exists public.internal_guests (
  guest_id uuid primary key,
  note text,
  created_at timestamptz not null default now()
);

-- Service-role access only, matching the other guest tables: RLS enabled with
-- no policies so anon/authenticated keys cannot touch guest data directly.
alter table public.internal_guests enable row level security;

grant all on public.internal_guests to service_role;

-- Backfill: all guest activity before guest mode had real traffic
-- (2026-07-26 21:00 America/Toronto, EDT = UTC-4) was developer testing, as
-- was trip 74. Identify developer guest ids two ways and union them:
-- owners of pre-cutoff guest trips (and trip 74), plus guest ids first seen
-- in guest_events before the cutoff, which also catches browsers that fired
-- events without ever creating a trip. No-op on fresh databases.

insert into public.internal_guests (guest_id, note)
select distinct guest_owner_id, 'backfill: developer testing before launch'
from public.trips
where guest_owner_id is not null
  and (created_at < timestamptz '2026-07-26 21:00:00-04' or id = 74)
on conflict (guest_id) do nothing;

insert into public.internal_guests (guest_id, note)
select guest_id, 'backfill: developer testing before launch'
from public.guest_events
group by guest_id
having min(created_at) < timestamptz '2026-07-26 21:00:00-04'
on conflict (guest_id) do nothing;
