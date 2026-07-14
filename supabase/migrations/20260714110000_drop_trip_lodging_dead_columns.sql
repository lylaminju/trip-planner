alter table public.trip_lodgings
  drop constraint if exists trip_lodgings_date_range_valid,
  drop column if exists address,
  drop column if exists check_in_date,
  drop column if exists check_out_date;
