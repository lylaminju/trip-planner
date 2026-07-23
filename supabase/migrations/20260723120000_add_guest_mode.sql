-- Guest mode: anonymous guest-owned ephemeral trips, guest quota usage rows,
-- and guest analytics events. Guests are identified by a signed cookie UUID;
-- they never get auth.users rows, so guest ownership lives on trips directly.

alter table public.trips
  add column if not exists guest_owner_id uuid,
  add column if not exists expires_at timestamptz;

create index if not exists trips_guest_owner_id_idx
  on public.trips (guest_owner_id)
  where guest_owner_id is not null;

create index if not exists trips_expires_at_idx
  on public.trips (expires_at)
  where expires_at is not null;

create table if not exists public.guest_api_usage (
  id bigint generated always as identity primary key,
  guest_id uuid not null,
  kind text not null,
  ip_hash text,
  called_at timestamptz not null default now()
);

create index if not exists guest_api_usage_guest_kind_idx
  on public.guest_api_usage (guest_id, kind, called_at);

create index if not exists guest_api_usage_kind_idx
  on public.guest_api_usage (kind, called_at);

create table if not exists public.guest_events (
  id bigint generated always as identity primary key,
  guest_id uuid not null,
  event_name text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists guest_events_guest_idx
  on public.guest_events (guest_id, created_at);

-- Service-role access only, matching the other tables: RLS enabled with no
-- policies so anon/authenticated keys cannot touch guest data directly.
alter table public.guest_api_usage enable row level security;
alter table public.guest_events enable row level security;
