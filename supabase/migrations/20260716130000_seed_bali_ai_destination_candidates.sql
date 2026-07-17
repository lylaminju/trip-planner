-- Seed AI planning candidates for the Bali destination.
-- Bali trips usually base in the southern beach hub (Kuta/Seminyak/Canggu),
-- so tiers are relative to that base: the beach strip is `central`, the Bukit
-- peninsula, Sanur, Tanah Lot, and the Ubud region (roughly an hour out) are
-- `nearby`, and the highlands, East Bali, and Nusa Penida are `day_trip`.
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
  ('bali', 'Kuta Beach', 'beach', array['nature', 'local-vibe'], 'Kuta', 'central', 1, -8.7185, 115.1686, null, 90, 'outdoor'),
  ('bali', 'Seminyak Beach', 'beach', array['nature', 'local-vibe'], 'Seminyak', 'central', 2, -8.6910, 115.1571, null, 90, 'outdoor'),
  ('bali', 'Potato Head Beach Club', 'beach', array['food', 'local-vibe'], 'Seminyak', 'central', 3, -8.6777, 115.1526, null, 180, 'mixed'),
  ('bali', 'Batu Bolong Beach', 'beach', array['local-vibe', 'nature'], 'Canggu', 'central', 4, -8.6598, 115.1303, null, 120, 'outdoor'),
  ('bali', 'Waterbom Bali', 'theme_park', array['kid-friendly'], 'Kuta', 'central', 5, -8.7280, 115.1693, null, 300, 'outdoor'),
  ('bali', 'Uluwatu Temple', 'landmark', array['landmarks', 'nature'], 'Uluwatu', 'nearby', 6, -8.8291, 115.0849, null, 120, 'outdoor'),
  ('bali', 'Padang Padang Beach', 'beach', array['nature'], 'Uluwatu', 'nearby', 7, -8.8110, 115.1037, null, 90, 'outdoor'),
  ('bali', 'Melasti Beach', 'beach', array['nature'], 'Ungasan', 'nearby', 8, -8.8483, 115.1610, null, 90, 'outdoor'),
  ('bali', 'Garuda Wisnu Kencana Cultural Park', 'landmark', array['landmarks', 'kid-friendly'], 'Ungasan', 'nearby', 9, -8.8104, 115.1675, null, 120, 'mixed'),
  ('bali', 'Jimbaran Bay', 'neighborhood', array['food', 'local-vibe'], 'Jimbaran', 'nearby', 10, -8.7770, 115.1650, null, 120, 'outdoor'),
  ('bali', 'Nusa Dua Beach', 'beach', array['nature', 'kid-friendly'], 'Nusa Dua', 'nearby', 11, -8.7960, 115.2330, null, 120, 'outdoor'),
  ('bali', 'Sanur Beach', 'beach', array['nature', 'local-vibe', 'kid-friendly'], 'Sanur', 'nearby', 12, -8.6935, 115.2631, null, 90, 'outdoor'),
  ('bali', 'Tanah Lot Temple', 'landmark', array['landmarks', 'nature'], 'Tabanan', 'nearby', 13, -8.6212, 115.0868, null, 90, 'outdoor'),
  ('bali', 'Sacred Monkey Forest Sanctuary', 'park', array['nature', 'landmarks'], 'Ubud', 'nearby', 14, -8.5186, 115.2587, null, 90, 'outdoor'),
  ('bali', 'Ubud Palace', 'landmark', array['landmarks'], 'Ubud', 'nearby', 15, -8.5065, 115.2625, null, 45, 'mixed'),
  ('bali', 'Ubud Art Market', 'market', array['shopping', 'local-vibe'], 'Ubud', 'nearby', 16, -8.5077, 115.2622, null, 60, 'mixed'),
  ('bali', 'Campuhan Ridge Walk', 'hike', array['nature'], 'Ubud', 'nearby', 17, -8.5039, 115.2542, null, 90, 'outdoor'),
  ('bali', 'Tegallalang Rice Terrace', 'viewpoint', array['nature'], 'Ubud', 'nearby', 18, -8.4315, 115.2785, null, 90, 'outdoor'),
  ('bali', 'Tegenungan Waterfall', 'viewpoint', array['nature'], 'Gianyar', 'nearby', 19, -8.5752, 115.2887, null, 60, 'outdoor'),
  ('bali', 'Goa Gajah', 'landmark', array['landmarks'], 'Ubud', 'nearby', 20, -8.5233, 115.2871, null, 60, 'mixed'),
  ('bali', 'Tirta Empul Temple', 'landmark', array['landmarks'], 'Tampaksiring', 'nearby', 21, -8.4155, 115.3153, null, 90, 'mixed'),
  ('bali', 'Bali Safari and Marine Park', 'zoo', array['kid-friendly', 'nature'], 'Gianyar', 'nearby', 22, -8.5810, 115.3480, null, 300, 'outdoor'),
  ('bali', 'Jatiluwih Rice Terraces', 'viewpoint', array['nature'], 'Tabanan', 'day_trip', 23, -8.3689, 115.1306, null, 120, 'outdoor'),
  ('bali', 'Ulun Danu Beratan Temple', 'landmark', array['landmarks', 'nature'], 'Bedugul', 'day_trip', 24, -8.2751, 115.1668, null, 90, 'outdoor'),
  ('bali', 'Mount Batur', 'hike', array['nature'], 'Kintamani', 'day_trip', 25, -8.2422, 115.3751, null, 360, 'outdoor'),
  ('bali', 'Besakih Great Temple', 'landmark', array['landmarks'], 'Karangasem', 'day_trip', 26, -8.3740, 115.4519, null, 150, 'outdoor'),
  ('bali', 'Lempuyang Temple', 'landmark', array['landmarks', 'nature'], 'Karangasem', 'day_trip', 27, -8.3902, 115.6317, null, 150, 'outdoor'),
  ('bali', 'Tirta Gangga', 'landmark', array['landmarks', 'nature', 'kid-friendly'], 'Karangasem', 'day_trip', 28, -8.4122, 115.5871, null, 90, 'outdoor'),
  ('bali', 'Kelingking Beach', 'viewpoint', array['nature'], 'Nusa Penida', 'day_trip', 29, -8.7514, 115.4720, null, 180, 'outdoor')
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

-- Arrival/departure hub for the wizard's transit step. Practically all Bali
-- trips arrive through Ngurah Rai; the hub table has no unique constraint, so
-- guard on (slug, name) to keep this migration re-runnable.
insert into public.ai_destination_transit_hubs
  (destination_slug, name, hub_type, iata_code, latitude, longitude, sort_order)
select *
from (
  values
    ('bali', 'Ngurah Rai International Airport', 'airport', 'DPS', -8.7482, 115.1672, 1)
) as new_hub (destination_slug, name, hub_type, iata_code, latitude, longitude, sort_order)
where not exists (
  select 1
  from public.ai_destination_transit_hubs existing
  where existing.destination_slug = new_hub.destination_slug
    and existing.name = new_hub.name
);
