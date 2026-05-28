# Trip Membership Migration

Issue #7 adds shared trips through `trips` and `trip_memberships`.

For existing deployments, create one default shared trip for the current New York City plan, add both current Supabase auth users as `owner` members, backfill planner tables with that trip id, then enforce non-null trip scoping.

Use the Supabase auth user UUIDs from the deployed project:

```sql
insert into public.trips (name, timezone, start_date, end_date, created_by)
values ('New York City', 'America/Toronto', null, null, '<FIRST_USER_UUID>')
returning id;

insert into public.trip_memberships (trip_id, user_id, role)
values
  (<TRIP_ID>, '<FIRST_USER_UUID>', 'owner'),
  (<TRIP_ID>, '<SECOND_USER_UUID>', 'owner');

update public.places
set trip_id = <TRIP_ID>
where trip_id is null;

update public.itinerary_items
set trip_id = <TRIP_ID>
where trip_id is null;

update public.route_segments
set trip_id = <TRIP_ID>
where trip_id is null;

alter table public.places alter column trip_id set not null;
alter table public.itinerary_items alter column trip_id set not null;
alter table public.route_segments alter column trip_id set not null;
```

Do not guess user UUIDs in application code. The deployment operator must supply them from Supabase Auth.
