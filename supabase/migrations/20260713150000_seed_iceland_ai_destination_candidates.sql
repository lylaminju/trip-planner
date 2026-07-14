-- Seed AI planning candidates for the Iceland destination.
-- Iceland is toured as a whole island, so tiers are relative to a Reykjavik
-- base: capital-area sights are `central`, Reykjanes/Golden Circle are `nearby`,
-- and the farther South Coast, Southeast, Snaefellsnes, and North are `day_trip`.
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
  ('iceland', 'Hallgrimskirkja', 'landmark', array['landmarks', 'viewpoints'], 'Reykjavik', 'central', 1, 64.1417, -21.9266, null, 45, 'mixed'),
  ('iceland', 'Sun Voyager', 'landmark', array['landmarks', 'viewpoints'], 'Reykjavik', 'central', 2, 64.1475, -21.9224, null, 30, 'outdoor'),
  ('iceland', 'Harpa Concert Hall', 'landmark', array['landmarks'], 'Reykjavik', 'central', 3, 64.1504, -21.9326, null, 60, 'indoor'),
  ('iceland', 'Perlan', 'museum', array['museums', 'viewpoints'], 'Reykjavik', 'central', 4, 64.1291, -21.9190, null, 120, 'indoor'),
  ('iceland', 'National Museum of Iceland', 'museum', array['museums'], 'Reykjavik', 'central', 5, 64.1420, -21.9483, null, 120, 'indoor'),
  ('iceland', 'Reykjavik Old Harbour', 'neighborhood', array['local-vibe', 'food'], 'Reykjavik', 'central', 6, 64.1533, -21.9426, null, 90, 'outdoor'),
  ('iceland', 'Laugavegur Shopping Street', 'neighborhood', array['local-vibe', 'food'], 'Reykjavik', 'central', 7, 64.1445, -21.9270, null, 90, 'outdoor'),
  ('iceland', 'Sky Lagoon', 'landmark', array['landmarks', 'nature'], 'Kopavogur', 'central', 8, 64.1178, -21.9430, null, 150, 'mixed'),
  ('iceland', 'Blue Lagoon', 'landmark', array['landmarks', 'nature'], 'Reykjanes Peninsula', 'nearby', 9, 63.8804, -22.4495, null, 180, 'mixed'),
  ('iceland', 'Bridge Between Continents', 'landmark', array['landmarks', 'nature'], 'Reykjanes Peninsula', 'nearby', 10, 63.8686, -22.6759, null, 45, 'outdoor'),
  ('iceland', 'Thingvellir National Park', 'park', array['nature', 'landmarks'], 'Golden Circle', 'nearby', 11, 64.2559, -21.1295, null, 120, 'outdoor'),
  ('iceland', 'Geysir Geothermal Area', 'landmark', array['nature', 'viewpoints'], 'Golden Circle', 'nearby', 12, 64.3104, -20.3024, null, 60, 'outdoor'),
  ('iceland', 'Gullfoss', 'viewpoint', array['nature', 'viewpoints'], 'Golden Circle', 'nearby', 13, 64.3271, -20.1199, null, 60, 'outdoor'),
  ('iceland', 'Kerid Crater', 'viewpoint', array['nature', 'viewpoints'], 'Golden Circle', 'nearby', 14, 64.0411, -20.8850, null, 45, 'outdoor'),
  ('iceland', 'Seljalandsfoss', 'viewpoint', array['nature', 'viewpoints'], 'South Coast', 'day_trip', 15, 63.6156, -19.9886, null, 45, 'outdoor'),
  ('iceland', 'Skogafoss', 'viewpoint', array['nature', 'viewpoints'], 'South Coast', 'day_trip', 16, 63.5321, -19.5114, null, 45, 'outdoor'),
  ('iceland', 'Reynisfjara Black Sand Beach', 'beach', array['nature', 'viewpoints'], 'South Coast', 'day_trip', 17, 63.4033, -19.0448, null, 60, 'outdoor'),
  ('iceland', 'Dyrholaey', 'viewpoint', array['nature', 'viewpoints'], 'South Coast', 'day_trip', 18, 63.4009, -19.1259, null, 60, 'outdoor'),
  ('iceland', 'Vik i Myrdal', 'neighborhood', array['local-vibe', 'viewpoints'], 'South Coast', 'day_trip', 19, 63.4186, -19.0060, null, 60, 'outdoor'),
  ('iceland', 'Solheimajokull Glacier', 'landmark', array['nature'], 'South Coast', 'day_trip', 20, 63.5311, -19.3688, null, 120, 'outdoor'),
  ('iceland', 'Fjadrargljufur Canyon', 'viewpoint', array['nature', 'viewpoints'], 'South Coast', 'day_trip', 21, 63.7713, -18.1723, null, 60, 'outdoor'),
  ('iceland', 'Skaftafell Nature Reserve', 'park', array['nature'], 'Southeast', 'day_trip', 22, 64.0166, -16.9668, null, 180, 'outdoor'),
  ('iceland', 'Svartifoss', 'viewpoint', array['nature', 'viewpoints'], 'Southeast', 'day_trip', 23, 64.0276, -16.9752, null, 90, 'outdoor'),
  ('iceland', 'Jokulsarlon Glacier Lagoon', 'viewpoint', array['nature', 'viewpoints'], 'Southeast', 'day_trip', 24, 64.0784, -16.2306, null, 90, 'outdoor'),
  ('iceland', 'Diamond Beach', 'beach', array['nature', 'viewpoints'], 'Southeast', 'day_trip', 25, 64.0421, -16.1793, null, 45, 'outdoor'),
  ('iceland', 'Kirkjufell', 'viewpoint', array['nature', 'viewpoints'], 'Snaefellsnes Peninsula', 'day_trip', 26, 64.9403, -23.3062, null, 60, 'outdoor'),
  ('iceland', 'Snaefellsjokull National Park', 'park', array['nature'], 'Snaefellsnes Peninsula', 'day_trip', 27, 64.8080, -23.7767, null, 180, 'outdoor'),
  ('iceland', 'Djupalonssandur Beach', 'beach', array['nature'], 'Snaefellsnes Peninsula', 'day_trip', 28, 64.7527, -23.9037, null, 60, 'outdoor'),
  ('iceland', 'Godafoss', 'viewpoint', array['nature', 'viewpoints'], 'North Iceland', 'day_trip', 29, 65.6828, -17.5500, null, 45, 'outdoor'),
  ('iceland', 'Lake Myvatn', 'park', array['nature'], 'North Iceland', 'day_trip', 30, 65.6039, -16.9962, null, 180, 'outdoor'),
  ('iceland', 'Myvatn Nature Baths', 'landmark', array['landmarks', 'nature'], 'North Iceland', 'day_trip', 31, 65.6306, -16.8497, null, 150, 'mixed'),
  ('iceland', 'Dettifoss', 'viewpoint', array['nature', 'viewpoints'], 'North Iceland', 'day_trip', 32, 65.8149, -16.3847, null, 60, 'outdoor'),
  ('iceland', 'Akureyri', 'neighborhood', array['local-vibe', 'food'], 'North Iceland', 'day_trip', 33, 65.6835, -18.0878, null, 120, 'mixed'),
  ('iceland', 'Husavik', 'viewpoint', array['nature', 'viewpoints'], 'North Iceland', 'day_trip', 34, 66.0449, -17.3389, null, 180, 'outdoor')
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

-- Mark a few family favorites (waterfalls, geysers, glacier lagoon) kid-friendly.
update public.ai_destination_candidates
set tags = tags || 'kid-friendly', updated_at = now()
where destination_slug = 'iceland'
  and not ('kid-friendly' = any(tags))
  and name in (
    'Perlan',
    'Thingvellir National Park',
    'Geysir Geothermal Area',
    'Gullfoss',
    'Seljalandsfoss',
    'Skogafoss',
    'Jokulsarlon Glacier Lagoon',
    'Godafoss',
    'Husavik'
  );
