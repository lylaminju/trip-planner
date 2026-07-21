-- New route segments default to driving instead of walking when the
-- straight-line (haversine) distance between the two stops exceeds 2 km.
-- Transit availability cannot be inferred without a paid API, and driving is
-- the only mode available almost everywhere, so long segments default to
-- driving and users switch to transit manually where it exists. Modes on
-- kept segments are untouched. The threshold mirrors
-- MAX_DEFAULT_WALKING_DISTANCE_KM in src/lib/route-reconciliation.ts.
create or replace function public.reconcile_route_segments_for_trip(p_trip_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Keep in sync with MAX_DEFAULT_WALKING_DISTANCE_KM in
  -- src/lib/route-reconciliation.ts.
  walking_distance_max_km constant double precision := 2;
  earth_radius_km constant double precision := 6371;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('route_segments', p_trip_id)
  );

  with routable_items as (
    select
      itinerary_items.id,
      lead(itinerary_items.id) over (
        partition by itinerary_items.visit_date
        order by
          split_part(itinerary_items.visit_time, ':', 1)::integer * 60
            + split_part(itinerary_items.visit_time, ':', 2)::integer,
          lower(places.name),
          places.name,
          itinerary_items.place_id
      ) as to_item_id
    from public.itinerary_items
    join public.places
      on places.id = itinerary_items.place_id
      and places.trip_id = itinerary_items.trip_id
    where itinerary_items.trip_id = p_trip_id
      and itinerary_items.visit_date is not null
      and itinerary_items.visit_date <> ''
      and itinerary_items.visit_time is not null
      and itinerary_items.visit_time ~ '^[0-9]{1,2}:[0-9]{2}$'
      and split_part(itinerary_items.visit_time, ':', 1)::integer between 0 and 23
      and split_part(itinerary_items.visit_time, ':', 2)::integer between 0 and 59
  ),
  desired_pairs as (
    select
      id as from_item_id,
      to_item_id
    from routable_items
    where to_item_id is not null
  ),
  ranked_existing_segments as (
    select
      route_segments.id,
      desired_pairs.from_item_id is not null as is_desired,
      row_number() over (
        partition by route_segments.from_item_id, route_segments.to_item_id
        order by route_segments.id
      ) as duplicate_rank
    from public.route_segments
    left join desired_pairs
      on desired_pairs.from_item_id = route_segments.from_item_id
      and desired_pairs.to_item_id = route_segments.to_item_id
    where route_segments.trip_id = p_trip_id
  )
  delete from public.route_segments
  where id in (
    select id
    from ranked_existing_segments
    where not is_desired
      or duplicate_rank > 1
  );

  with routable_items as (
    select
      itinerary_items.id,
      places.latitude,
      places.longitude,
      lead(itinerary_items.id) over next_visit as to_item_id,
      lead(places.latitude) over next_visit as to_latitude,
      lead(places.longitude) over next_visit as to_longitude
    from public.itinerary_items
    join public.places
      on places.id = itinerary_items.place_id
      and places.trip_id = itinerary_items.trip_id
    where itinerary_items.trip_id = p_trip_id
      and itinerary_items.visit_date is not null
      and itinerary_items.visit_date <> ''
      and itinerary_items.visit_time is not null
      and itinerary_items.visit_time ~ '^[0-9]{1,2}:[0-9]{2}$'
      and split_part(itinerary_items.visit_time, ':', 1)::integer between 0 and 23
      and split_part(itinerary_items.visit_time, ':', 2)::integer between 0 and 59
    window next_visit as (
      partition by itinerary_items.visit_date
      order by
        split_part(itinerary_items.visit_time, ':', 1)::integer * 60
          + split_part(itinerary_items.visit_time, ':', 2)::integer,
        lower(places.name),
        places.name,
        itinerary_items.place_id
    )
  ),
  desired_pairs as (
    select
      id as from_item_id,
      to_item_id,
      case
        when 2 * earth_radius_km * asin(sqrt(least(1,
          power(sin(radians((to_latitude - latitude) / 2)), 2)
            + cos(radians(latitude)) * cos(radians(to_latitude))
              * power(sin(radians((to_longitude - longitude) / 2)), 2)
        ))) > walking_distance_max_km
          then 'driving'
        else 'walking'
      end as mode
    from routable_items
    where to_item_id is not null
  )
  insert into public.route_segments (trip_id, from_item_id, to_item_id, mode)
  select
    p_trip_id,
    desired_pairs.from_item_id,
    desired_pairs.to_item_id,
    desired_pairs.mode
  from desired_pairs
  where not exists (
    select 1
    from public.route_segments
    where route_segments.trip_id = p_trip_id
      and route_segments.from_item_id = desired_pairs.from_item_id
      and route_segments.to_item_id = desired_pairs.to_item_id
  )
  on conflict (trip_id, from_item_id, to_item_id) do nothing;
end;
$$;
