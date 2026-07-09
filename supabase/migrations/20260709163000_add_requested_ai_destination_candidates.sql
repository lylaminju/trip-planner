insert into public.ai_destination_candidates (
  destination_slug,
  name,
  category,
  tags,
  area,
  region_distance_tier,
  sort_order,
  latitude,
  longitude,
  google_place_id,
  typical_duration_minutes,
  indoor_outdoor
)
values
  (
    'new-york-city',
    'Little Island',
    'park',
    array['nature', 'viewpoints', 'kid-friendly', 'low-cost-free'],
    'Chelsea',
    'central',
    16,
    40.7420024,
    -74.010299,
    null,
    60,
    'outdoor'
  ),
  (
    'los-angeles',
    'Joshua Tree National Park',
    'national_park',
    array['nature', 'viewpoints'],
    'Joshua Tree',
    'day_trip',
    16,
    33.873415,
    -115.9009923,
    null,
    360,
    'outdoor'
  )
on conflict (destination_slug, lower(name))
do update set
  category = excluded.category,
  tags = excluded.tags,
  area = excluded.area,
  region_distance_tier = excluded.region_distance_tier,
  sort_order = excluded.sort_order,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  google_place_id = excluded.google_place_id,
  typical_duration_minutes = excluded.typical_duration_minutes,
  indoor_outdoor = excluded.indoor_outdoor,
  updated_at = now();
