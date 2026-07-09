update public.ai_destination_candidates
set
  tags = array_remove(
    array_remove(tags, 'kid-friendly'),
    'low-cost-free'
  ),
  updated_at = now()
where tags && array['kid-friendly', 'low-cost-free'];

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
  ('new-york-city', 'Village Vanguard', 'jazz_club', array['landmarks', 'neighborhoods'], 'Greenwich Village', 'central', 17, 40.736, -74.0016, null, 150, 'indoor'),
  ('new-york-city', 'Whitney Museum of American Art', 'museum', array['museums', 'viewpoints'], 'Meatpacking District', 'central', 18, 40.7396, -74.0089, null, 150, 'indoor'),
  ('new-york-city', 'Chelsea Market', 'market', array['neighborhoods'], 'Chelsea', 'central', 19, 40.7424, -74.006, null, 75, 'indoor'),
  ('new-york-city', 'Washington Square Park', 'park', array['nature', 'landmarks', 'neighborhoods'], 'Greenwich Village', 'central', 20, 40.730823, -73.997332, null, 60, 'outdoor'),
  ('new-york-city', 'One World Observatory', 'viewpoint', array['landmarks', 'viewpoints'], 'Lower Manhattan', 'central', 21, 40.713, -74.0132, null, 90, 'indoor'),
  ('new-york-city', 'Rockefeller Center', 'landmark', array['landmarks'], 'Midtown Manhattan', 'central', 22, 40.75874, -73.978674, null, 75, 'mixed'),
  ('new-york-city', 'St. Patrick''s Cathedral', 'landmark', array['landmarks'], 'Midtown Manhattan', 'central', 23, 40.758465, -73.975993, null, 45, 'indoor'),
  ('new-york-city', 'SoHo Cast Iron Historic District', 'neighborhood', array['neighborhoods', 'landmarks'], 'SoHo', 'central', 24, 40.724, -74.0007, null, 75, 'outdoor'),
  ('new-york-city', 'Tenement Museum', 'museum', array['museums', 'neighborhoods'], 'Lower East Side', 'central', 25, 40.7188, -73.9901, null, 90, 'indoor'),
  ('new-york-city', 'Apollo Theater', 'landmark', array['landmarks'], 'Harlem', 'central', 26, 40.81, -73.95, null, 90, 'indoor'),
  ('new-york-city', 'Coney Island Boardwalk', 'beach', array['landmarks', 'viewpoints', 'neighborhoods'], 'Brooklyn', 'day_trip', 27, 40.5755, -73.9707, null, 120, 'outdoor'),
  ('new-york-city', 'Brooklyn Botanic Garden', 'garden', array['nature'], 'Brooklyn', 'nearby', 28, 40.6676, -73.963, null, 120, 'outdoor'),
  ('new-york-city', 'Governors Island', 'park', array['nature', 'viewpoints'], 'New York Harbor', 'nearby', 29, 40.6895, -74.0168, null, 150, 'outdoor'),
  ('new-york-city', 'Roosevelt Island Tramway', 'viewpoint', array['viewpoints', 'landmarks'], 'Upper East Side and Roosevelt Island', 'central', 30, 40.7616, -73.9641, null, 45, 'mixed'),
  ('los-angeles', 'The Baked Potato', 'jazz_club', array['landmarks', 'neighborhoods'], 'Studio City', 'nearby', 17, 34.1356, -118.3617, null, 150, 'indoor'),
  ('los-angeles', 'Universal Studios Hollywood', 'theme_park', array['landmarks'], 'Universal City', 'nearby', 18, 34.138117, -118.353378, null, 240, 'mixed'),
  ('los-angeles', 'Hollywood Bowl', 'landmark', array['landmarks', 'viewpoints'], 'Hollywood Hills', 'central', 19, 34.112778, -118.338889, null, 120, 'outdoor'),
  ('los-angeles', 'Academy Museum of Motion Pictures', 'museum', array['museums'], 'Miracle Mile', 'central', 20, 34.0628, -118.3611, null, 120, 'indoor'),
  ('los-angeles', 'Grand Central Market', 'market', array['neighborhoods', 'landmarks'], 'Downtown', 'central', 21, 34.0507, -118.2487, null, 75, 'indoor'),
  ('los-angeles', 'Olvera Street', 'neighborhood', array['neighborhoods', 'landmarks'], 'El Pueblo', 'central', 22, 34.0573, -118.2371, null, 75, 'outdoor'),
  ('los-angeles', 'The Huntington Library, Art Museum, and Botanical Gardens', 'museum', array['museums', 'nature'], 'San Marino', 'day_trip', 23, 34.12722, -118.11, null, 240, 'mixed'),
  ('los-angeles', 'Descanso Gardens', 'garden', array['nature'], 'La Canada Flintridge', 'day_trip', 24, 34.2014, -118.2107, null, 150, 'outdoor'),
  ('los-angeles', 'California Science Center', 'museum', array['museums'], 'Exposition Park', 'central', 25, 34.016, -118.2863, null, 120, 'indoor'),
  ('los-angeles', 'Natural History Museum of Los Angeles County', 'museum', array['museums'], 'Exposition Park', 'central', 26, 34.0169, -118.2888, null, 120, 'indoor'),
  ('los-angeles', 'Watts Towers', 'landmark', array['landmarks'], 'Watts', 'nearby', 27, 33.9386, -118.2411, null, 60, 'outdoor'),
  ('los-angeles', 'Aquarium of the Pacific', 'aquarium', array['museums'], 'Long Beach', 'day_trip', 28, 33.7629, -118.1956, null, 150, 'mixed'),
  ('los-angeles', 'Malibu Creek State Park', 'hike', array['nature', 'viewpoints'], 'Malibu and Calabasas', 'day_trip', 29, 34.0983, -118.711, null, 180, 'outdoor'),
  ('los-angeles', 'The Grove and Original Farmers Market', 'market', array['neighborhoods'], 'Fairfax', 'central', 30, 34.072, -118.357, null, 90, 'mixed'),
  ('banff-national-park', 'Banff Upper Hot Springs', 'landmark', array['nature', 'viewpoints'], 'Sulphur Mountain', 'central', 16, 51.1512, -115.5608, null, 90, 'mixed'),
  ('banff-national-park', 'Cascade of Time Garden', 'park', array['nature', 'landmarks'], 'Banff Town', 'central', 17, 51.1736, -115.5723, null, 45, 'outdoor'),
  ('banff-national-park', 'Tunnel Mountain Trail', 'hike', array['nature', 'viewpoints'], 'Banff Town', 'central', 18, 51.1762, -115.5619, null, 120, 'outdoor'),
  ('banff-national-park', 'Mount Norquay Lookout', 'viewpoint', array['nature', 'viewpoints'], 'Mount Norquay', 'nearby', 19, 51.203, -115.5986, null, 45, 'outdoor'),
  ('banff-national-park', 'Lake Agnes Tea House Trail', 'hike', array['nature', 'viewpoints'], 'Lake Louise', 'nearby', 20, 51.4171, -116.2399, null, 180, 'outdoor'),
  ('banff-national-park', 'Plain of Six Glaciers Trail', 'hike', array['nature', 'viewpoints'], 'Lake Louise', 'nearby', 21, 51.405, -116.2503, null, 210, 'outdoor'),
  ('banff-national-park', 'Emerald Lake', 'scenic_lake', array['nature', 'viewpoints'], 'Yoho National Park', 'day_trip', 22, 51.4389, -116.5304, null, 120, 'outdoor'),
  ('banff-national-park', 'Takakkaw Falls', 'viewpoint', array['nature', 'viewpoints'], 'Yoho National Park', 'day_trip', 23, 51.5008, -116.4749, null, 90, 'outdoor'),
  ('banff-national-park', 'Athabasca Glacier', 'viewpoint', array['nature', 'viewpoints'], 'Columbia Icefield', 'day_trip', 24, 52.2206, -117.2246, null, 150, 'outdoor'),
  ('banff-national-park', 'Mistaya Canyon', 'viewpoint', array['nature', 'viewpoints'], 'Icefields Parkway', 'day_trip', 25, 51.948, -116.7226, null, 60, 'outdoor')
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
