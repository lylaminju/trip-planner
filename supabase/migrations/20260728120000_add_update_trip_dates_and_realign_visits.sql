-- Trip date edits used to write the trips row and shift itinerary visit dates
-- as separate round trips, so a failure between them stranded the itinerary on
-- dates the trip no longer covered, and a retry read the already-updated trip
-- and computed a zero shift. This function commits both writes in one
-- transaction, and refuses to apply a shift computed against trip dates that
-- have since changed.
create or replace function public.update_trip_dates_and_realign_visits(
  p_trip_id bigint,
  p_prev_start_date date,
  p_prev_end_date date,
  p_next_start_date date,
  p_next_end_date date,
  p_visit_changes jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_trip_count integer;
  unschedules_visit boolean;
begin
  -- The caller computed p_visit_changes from the trip dates it last read;
  -- applying them against different dates would corrupt the itinerary, so a
  -- concurrent date edit aborts the whole transaction instead.
  update public.trips
  set
    start_date = p_next_start_date,
    end_date = p_next_end_date,
    updated_at = now()
  where id = p_trip_id
    and deleted_at is null
    and start_date is not distinct from p_prev_start_date
    and end_date is not distinct from p_prev_end_date;

  get diagnostics updated_trip_count = row_count;
  if updated_trip_count = 0 then
    raise exception
      'trip % is missing or its dates changed concurrently; visit realignment aborted',
      p_trip_id;
  end if;

  update public.itinerary_items
  set
    visit_date = changes.visit_date,
    updated_at = now()
  from jsonb_to_recordset(p_visit_changes)
    as changes(id bigint, visit_date text)
  where itinerary_items.trip_id = p_trip_id
    and itinerary_items.id = changes.id;

  -- Shifting every visit by one delta preserves each day's grouping and order,
  -- so only an unscheduled visit can leave a route segment dangling.
  select bool_or(changes.visit_date is null)
  into unschedules_visit
  from jsonb_to_recordset(p_visit_changes)
    as changes(id bigint, visit_date text);

  if coalesce(unschedules_visit, false) then
    perform public.reconcile_route_segments_for_trip(p_trip_id);
  end if;
end;
$$;

revoke all on function public.update_trip_dates_and_realign_visits(bigint, date, date, date, date, jsonb) from public;
grant execute on function public.update_trip_dates_and_realign_visits(bigint, date, date, date, date, jsonb) to service_role;
