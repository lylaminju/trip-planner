-- Correct the Hoodoos Viewpoint coordinates for Banff National Park.
-- The original seed placed it at 51.1852, -115.5379 (~1.2 km southwest, back
-- near the Tunnel Mountain campground). The actual Hoodoos Viewpoint day-use
-- area at the northeast end of Tunnel Mountain Road sits at 51.1895, -115.5212.
update public.ai_destination_candidates
set
  latitude = 51.1895,
  longitude = -115.5212,
  updated_at = now()
where destination_slug = 'banff-national-park'
  and name = 'Hoodoos Viewpoint'
  and latitude = 51.1852
  and longitude = -115.5379;
