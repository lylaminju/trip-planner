-- Persist the transit-hub type (airport, train station, bus, ferry) on a trip's
-- arrival/departure points. The AI planner uses it to reserve realistic buffer
-- time: airports need ~60 min to exit after landing and ~150 min before a
-- departure, while other hubs need much less. Null means a custom Google Maps
-- point whose type is unknown; those fall back to the smaller non-airport buffer.
alter table public.trip_transit_points
  add column if not exists hub_type text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trip_transit_points_hub_type_valid'
      and conrelid = 'public.trip_transit_points'::regclass
  ) then
    alter table public.trip_transit_points
      add constraint trip_transit_points_hub_type_valid
      check (
        hub_type is null
        or hub_type in ('airport', 'train_station', 'bus_terminal', 'ferry_terminal')
      );
  end if;
end;
$$;
