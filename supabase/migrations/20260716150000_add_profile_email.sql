-- Members are invited by account email, and PostgREST cannot read auth.users,
-- so the profiles mirror needs the email for lookups.
alter table public.profiles
  add column if not exists email text;

create or replace function public.handle_auth_user_profile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, username, profile_color, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name'
    ),
    new.raw_user_meta_data->>'profile_color',
    new.email
  )
  on conflict (user_id) do update
    set username = excluded.username,
        profile_color = excluded.profile_color,
        email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

update public.profiles
set email = auth_users.email,
    updated_at = now()
from auth.users as auth_users
where public.profiles.user_id = auth_users.id
  and public.profiles.email is distinct from auth_users.email;
