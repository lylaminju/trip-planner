alter table public.trips
  add column if not exists deleted_at timestamptz;

create index if not exists idx_trips_active
  on public.trips (id)
  where deleted_at is null;
