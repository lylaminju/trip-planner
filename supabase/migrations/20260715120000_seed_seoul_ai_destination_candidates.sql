-- Seed AI planning candidates for the Seoul destination.
-- Tiers are relative to a central-Seoul base: sights inside the city are
-- `central`, the greater-Seoul ring (Bukhansan, Gwacheon) is `nearby`, and
-- Gyeonggi/Gangwon/Incheon trips (Suwon, Everland, Nami, DMZ) are `day_trip`.
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
  ('seoul', 'Gyeongbokgung Palace', 'landmark', array['landmarks'], 'Jongno', 'central', 1, 37.5796, 126.9770, null, 120, 'mixed'),
  ('seoul', 'Changdeokgung Palace', 'landmark', array['landmarks', 'nature'], 'Jongno', 'central', 2, 37.5794, 126.9910, null, 120, 'mixed'),
  ('seoul', 'Changgyeonggung Palace', 'landmark', array['landmarks'], 'Jongno', 'central', 3, 37.5786, 126.9950, null, 90, 'mixed'),
  ('seoul', 'Deoksugung Palace', 'landmark', array['landmarks'], 'Jung-gu', 'central', 4, 37.5658, 126.9751, null, 90, 'mixed'),
  ('seoul', 'Jongmyo Shrine', 'landmark', array['landmarks'], 'Jongno', 'central', 5, 37.5745, 126.9942, null, 90, 'mixed'),
  ('seoul', 'Gwanghwamun Square', 'landmark', array['landmarks', 'local-vibe'], 'Jongno', 'central', 6, 37.5725, 126.9769, null, 45, 'outdoor'),
  ('seoul', 'Bukchon Hanok Village', 'neighborhood', array['local-vibe', 'landmarks'], 'Jongno', 'central', 7, 37.5826, 126.9830, null, 90, 'outdoor'),
  ('seoul', 'Insadong', 'neighborhood', array['local-vibe', 'shopping'], 'Jongno', 'central', 8, 37.5740, 126.9856, null, 90, 'outdoor'),
  ('seoul', 'Ikseon-dong Hanok Village', 'neighborhood', array['local-vibe', 'food'], 'Jongno', 'central', 9, 37.5741, 126.9903, null, 90, 'outdoor'),
  ('seoul', 'N Seoul Tower', 'viewpoint', array['landmarks', 'kid-friendly'], 'Namsan', 'central', 10, 37.5512, 126.9882, null, 120, 'mixed'),
  ('seoul', 'Namsan Park', 'park', array['nature'], 'Namsan', 'central', 11, 37.5509, 126.9906, null, 90, 'outdoor'),
  ('seoul', 'Myeongdong Shopping Street', 'neighborhood', array['shopping', 'food'], 'Jung-gu', 'central', 12, 37.5636, 126.9827, null, 120, 'outdoor'),
  ('seoul', 'Dongdaemun Design Plaza', 'landmark', array['landmarks', 'shopping'], 'Jung-gu', 'central', 13, 37.5665, 127.0092, null, 90, 'mixed'),
  ('seoul', 'Gwangjang Market', 'market', array['food', 'local-vibe'], 'Jongno', 'central', 14, 37.5701, 126.9997, null, 90, 'mixed'),
  ('seoul', 'Namdaemun Market', 'market', array['food', 'shopping'], 'Jung-gu', 'central', 15, 37.5591, 126.9773, null, 90, 'mixed'),
  ('seoul', 'Sungnyemun', 'landmark', array['landmarks'], 'Jung-gu', 'central', 16, 37.5600, 126.9753, null, 30, 'outdoor'),
  ('seoul', 'Cheonggyecheon', 'park', array['nature', 'local-vibe'], 'Jung-gu', 'central', 17, 37.5696, 126.9784, null, 60, 'outdoor'),
  ('seoul', 'Seoullo 7017', 'park', array['nature', 'local-vibe'], 'Jung-gu', 'central', 18, 37.5563, 126.9723, null, 45, 'outdoor'),
  ('seoul', 'National Museum of Korea', 'museum', array['museums', 'kid-friendly'], 'Yongsan', 'central', 19, 37.5240, 126.9803, null, 150, 'indoor'),
  ('seoul', 'War Memorial of Korea', 'museum', array['museums', 'kid-friendly'], 'Yongsan', 'central', 20, 37.5369, 126.9774, null, 120, 'mixed'),
  ('seoul', 'Leeum Museum of Art', 'museum', array['museums'], 'Itaewon', 'central', 21, 37.5384, 126.9993, null, 120, 'indoor'),
  ('seoul', 'National Folk Museum of Korea', 'museum', array['museums', 'kid-friendly'], 'Jongno', 'central', 22, 37.5815, 126.9791, null, 90, 'indoor'),
  ('seoul', 'Seodaemun Prison History Hall', 'museum', array['museums'], 'Seodaemun', 'central', 23, 37.5745, 126.9560, null, 90, 'mixed'),
  ('seoul', 'Itaewon', 'neighborhood', array['local-vibe', 'food'], 'Yongsan', 'central', 24, 37.5345, 126.9946, null, 90, 'outdoor'),
  ('seoul', 'Hongdae', 'neighborhood', array['local-vibe', 'food', 'shopping'], 'Mapo', 'central', 25, 37.5563, 126.9236, null, 120, 'outdoor'),
  ('seoul', 'Gyeongui Line Forest Park', 'park', array['nature', 'local-vibe'], 'Mapo', 'central', 26, 37.5602, 126.9255, null, 60, 'outdoor'),
  ('seoul', 'Garosu-gil', 'neighborhood', array['shopping', 'local-vibe'], 'Gangnam', 'central', 27, 37.5209, 127.0230, null, 90, 'outdoor'),
  ('seoul', 'Starfield Library at COEX Mall', 'landmark', array['shopping', 'landmarks'], 'Gangnam', 'central', 28, 37.5115, 127.0595, null, 90, 'indoor'),
  ('seoul', 'Bongeunsa Temple', 'landmark', array['landmarks'], 'Gangnam', 'central', 29, 37.5148, 127.0577, null, 60, 'mixed'),
  ('seoul', 'COEX Aquarium', 'aquarium', array['kid-friendly'], 'Gangnam', 'central', 30, 37.5130, 127.0587, null, 120, 'indoor'),
  ('seoul', 'Lotte World Tower', 'viewpoint', array['landmarks', 'kid-friendly'], 'Jamsil', 'central', 31, 37.5125, 127.1025, null, 120, 'indoor'),
  ('seoul', 'Lotte World Adventure', 'theme_park', array['kid-friendly'], 'Jamsil', 'central', 32, 37.5111, 127.0980, null, 240, 'mixed'),
  ('seoul', 'Seoul Forest', 'park', array['nature', 'kid-friendly'], 'Seongdong', 'central', 33, 37.5444, 127.0374, null, 120, 'outdoor'),
  ('seoul', 'Yeouido Hangang Park', 'park', array['nature', 'local-vibe'], 'Yeouido', 'central', 34, 37.5285, 126.9340, null, 120, 'outdoor'),
  ('seoul', 'Noryangjin Fish Market', 'market', array['food', 'local-vibe'], 'Dongjak', 'central', 35, 37.5145, 126.9425, null, 90, 'indoor'),
  ('seoul', 'Ihwa Mural Village', 'neighborhood', array['local-vibe'], 'Jongno', 'central', 36, 37.5796, 127.0074, null, 60, 'outdoor'),
  ('seoul', 'Naksan Park', 'viewpoint', array['nature', 'landmarks'], 'Jongno', 'central', 37, 37.5808, 127.0075, null, 90, 'outdoor'),
  ('seoul', 'Inwangsan', 'hike', array['nature', 'landmarks'], 'Jongno', 'central', 38, 37.5800, 126.9585, null, 150, 'outdoor'),
  ('seoul', 'Bukhansan National Park', 'national_park', array['nature'], 'Gangbuk', 'nearby', 39, 37.6586, 126.9779, null, 240, 'outdoor'),
  ('seoul', 'Seoul Grand Park', 'zoo', array['kid-friendly', 'nature'], 'Gwacheon', 'nearby', 40, 37.4275, 127.0176, null, 240, 'outdoor'),
  ('seoul', 'Hwaseong Fortress', 'landmark', array['landmarks'], 'Suwon', 'day_trip', 41, 37.2881, 127.0139, null, 180, 'outdoor'),
  ('seoul', 'Korean Folk Village', 'landmark', array['landmarks', 'kid-friendly'], 'Yongin', 'day_trip', 42, 37.2596, 127.0180, null, 240, 'outdoor'),
  ('seoul', 'Everland', 'theme_park', array['kid-friendly'], 'Yongin', 'day_trip', 43, 37.2946, 127.2021, null, 300, 'outdoor'),
  ('seoul', 'Nami Island', 'park', array['nature', 'kid-friendly'], 'Chuncheon', 'day_trip', 44, 37.7902, 127.5259, null, 240, 'outdoor'),
  ('seoul', 'Imjingak', 'landmark', array['landmarks'], 'Paju (DMZ)', 'day_trip', 45, 37.8894, 126.7422, null, 240, 'mixed'),
  ('seoul', 'Incheon Chinatown', 'neighborhood', array['food', 'local-vibe'], 'Incheon', 'day_trip', 46, 37.4757, 126.6178, null, 120, 'outdoor')
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

-- Arrival/departure hubs for the wizard's transit step. The hub table has no
-- unique constraint, so guard on (slug, name) to keep this migration re-runnable.
insert into public.ai_destination_transit_hubs
  (destination_slug, name, hub_type, iata_code, latitude, longitude, sort_order)
select *
from (
  values
    ('seoul', 'Incheon International Airport', 'airport', 'ICN', 37.4602, 126.4407, 1),
    ('seoul', 'Gimpo International Airport', 'airport', 'GMP', 37.5583, 126.7906, 2),
    ('seoul', 'Seoul Station', 'train_station', null, 37.5546, 126.9707, 3),
    ('seoul', 'Suseo Station', 'train_station', null, 37.4874, 127.1044, 4),
    ('seoul', 'Express Bus Terminal', 'bus_terminal', null, 37.5049, 127.0048, 5)
) as new_hub (destination_slug, name, hub_type, iata_code, latitude, longitude, sort_order)
where not exists (
  select 1
  from public.ai_destination_transit_hubs existing
  where existing.destination_slug = new_hub.destination_slug
    and existing.name = new_hub.name
);
