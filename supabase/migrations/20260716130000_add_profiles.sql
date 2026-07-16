-- Queryable mirror of auth.users user_metadata, which PostgREST cannot
-- read or join when resolving trip members for display.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  profile_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upserts a user's profile from their metadata; the username fallback chain
-- matches the app's display-name resolution (username -> name -> full_name).
create or replace function public.handle_auth_user_profile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, username, profile_color)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name'
    ),
    new.raw_user_meta_data->>'profile_color'
  )
  on conflict (user_id) do update
    set username = excluded.username,
        profile_color = excluded.profile_color,
        updated_at = now();
  return new;
end;
$$;

-- Keeps profiles in sync for dashboard-created users and in-app profile edits.
drop trigger if exists on_auth_user_profile_sync on auth.users;
create trigger on_auth_user_profile_sync
  after insert or update on auth.users
  for each row execute function public.handle_auth_user_profile_sync();

-- Backfills profiles for users that existed before the trigger.
insert into public.profiles (user_id, username, profile_color)
select
  id,
  coalesce(
    raw_user_meta_data->>'username',
    raw_user_meta_data->>'name',
    raw_user_meta_data->>'full_name'
  ),
  raw_user_meta_data->>'profile_color'
from auth.users
on conflict (user_id) do update
  set username = excluded.username,
      profile_color = excluded.profile_color,
      updated_at = now();

alter table public.profiles enable row level security;

grant all on public.profiles to service_role;
