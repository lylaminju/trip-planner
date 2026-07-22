-- Backfill destination coordinates and country codes for preset trips.
--
-- Preset trips were created storing only their destination_slug, with
-- coordinates and country codes derived from the curated preset list at read
-- time. This makes the stored columns the single source of truth so place
-- search can bias and restrict to the destination country without a runtime
-- fallback. Idempotent: only fills columns that are currently null, matching
-- each trip to its preset by slug.

UPDATE trips AS t
SET
  destination_latitude = COALESCE(t.destination_latitude, p.latitude),
  destination_longitude = COALESCE(t.destination_longitude, p.longitude),
  destination_country_codes = COALESCE(t.destination_country_codes, ARRAY[p.country_code])
FROM (VALUES
  ('amsterdam', 'NL', 52.3676, 4.9041),
  ('athens', 'GR', 37.9838, 23.7275),
  ('bali', 'ID', -8.4095, 115.1889),
  ('banff-national-park', 'CA', 51.4968, -115.9281),
  ('bangkok', 'TH', 13.7563, 100.5018),
  ('barcelona', 'ES', 41.3874, 2.1686),
  ('beijing', 'CN', 39.9042, 116.4074),
  ('berlin', 'DE', 52.52, 13.405),
  ('buenos-aires', 'AR', -34.6037, -58.3816),
  ('cairo', 'EG', 30.0444, 31.2357),
  ('calgary', 'CA', 51.0447, -114.0719),
  ('cancun', 'MX', 21.1619, -86.8515),
  ('cape-town', 'ZA', -33.9249, 18.4241),
  ('chicago', 'US', 41.8781, -87.6298),
  ('copenhagen', 'DK', 55.6761, 12.5683),
  ('doha', 'QA', 25.2854, 51.531),
  ('dubai', 'AE', 25.2048, 55.2708),
  ('dublin', 'IE', 53.3498, -6.2603),
  ('edinburgh', 'GB', 55.9533, -3.1883),
  ('florence', 'IT', 43.7696, 11.2558),
  ('hanoi', 'VN', 21.0278, 105.8342),
  ('ho-chi-minh-city', 'VN', 10.8231, 106.6297),
  ('hong-kong', 'HK', 22.3193, 114.1694),
  ('honolulu', 'US', 21.3069, -157.8583),
  ('iceland', 'IS', 64.9631, -19.0208),
  ('istanbul', 'TR', 41.0082, 28.9784),
  ('kuala-lumpur', 'MY', 3.139, 101.6869),
  ('kyoto', 'JP', 35.0116, 135.7681),
  ('las-vegas', 'US', 36.1699, -115.1398),
  ('lisbon', 'PT', 38.7223, -9.1393),
  ('london', 'GB', 51.5074, -0.1278),
  ('los-angeles', 'US', 34.0522, -118.2437),
  ('madrid', 'ES', 40.4168, -3.7038),
  ('marrakech', 'MA', 31.6295, -7.9811),
  ('mexico-city', 'MX', 19.4326, -99.1332),
  ('miami', 'US', 25.7617, -80.1918),
  ('milan', 'IT', 45.4642, 9.19),
  ('montreal', 'CA', 45.5017, -73.5673),
  ('munich', 'DE', 48.1351, 11.582),
  ('new-york-city', 'US', 40.7128, -74.006),
  ('osaka', 'JP', 34.6937, 135.5023),
  ('paris', 'FR', 48.8566, 2.3522),
  ('prague', 'CZ', 50.0755, 14.4378),
  ('quebec-city', 'CA', 46.8139, -71.208),
  ('rio-de-janeiro', 'BR', -22.9068, -43.1729),
  ('rome', 'IT', 41.9028, 12.4964),
  ('san-francisco', 'US', 37.7749, -122.4194),
  ('seoul', 'KR', 37.5665, 126.978),
  ('singapore', 'SG', 1.3521, 103.8198),
  ('sydney', 'AU', -33.8688, 151.2093),
  ('taipei', 'TW', 25.033, 121.5654),
  ('tokyo', 'JP', 35.6762, 139.6503),
  ('toronto', 'CA', 43.6532, -79.3832),
  ('vancouver', 'CA', 49.2827, -123.1207),
  ('venice', 'IT', 45.4408, 12.3155),
  ('victoria', 'CA', 48.4284, -123.3656),
  ('vienna', 'AT', 48.2082, 16.3738),
  ('washington-dc', 'US', 38.9072, -77.0369),
  ('zurich', 'CH', 47.3769, 8.5417)
) AS p(slug, country_code, latitude, longitude)
WHERE t.destination_slug = p.slug
  AND (
    t.destination_latitude IS NULL
    OR t.destination_longitude IS NULL
    OR t.destination_country_codes IS NULL
  );
