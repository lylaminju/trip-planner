-- Rename the `neighborhoods` interest tag to `local-vibe` and introduce the
-- `food` and `kid-friendly` interest tags, then curate existing candidates.

-- 1. Rename `neighborhoods` -> `local-vibe` on candidates.
update public.ai_destination_candidates
set
  tags = array_replace(tags, 'neighborhoods', 'local-vibe'),
  updated_at = now()
where 'neighborhoods' = any(tags);

-- 2. Rename `neighborhoods` -> `local-vibe` on saved trip preferences.
update public.ai_planning_preferences
set
  interest_tags = array_replace(interest_tags, 'neighborhoods', 'local-vibe'),
  updated_at = now()
where 'neighborhoods' = any(interest_tags);

-- 3. Tag `food` candidates (markets and food-culture destinations).
update public.ai_destination_candidates
set tags = tags || 'food', updated_at = now()
where not ('food' = any(tags))
  and (
    (destination_slug = 'banff-national-park' and name in ('Banff Avenue'))
    or (destination_slug = 'los-angeles' and name in (
      'Grand Central Market',
      'The Grove and Original Farmers Market',
      'Olvera Street'
    ))
    or (destination_slug = 'new-york-city' and name in ('Chelsea Market'))
    or (destination_slug = 'toronto' and name in (
      'St. Lawrence Market',
      'Kensington Market',
      'Distillery District',
      'Little Italy',
      'Chinatown'
    ))
  );

-- 4. Tag `kid-friendly` candidates (attractions especially good for families).
update public.ai_destination_candidates
set tags = tags || 'kid-friendly', updated_at = now()
where not ('kid-friendly' = any(tags))
  and (
    (destination_slug = 'banff-national-park' and name in (
      'Banff Gondola and Sulphur Mountain',
      'Lake Louise',
      'Moraine Lake',
      'Lake Minnewanka',
      'Banff Upper Hot Springs',
      'Lake Louise Sightseeing Gondola',
      'Cave and Basin National Historic Site',
      'Johnston Canyon'
    ))
    or (destination_slug = 'los-angeles' and name in (
      'Griffith Observatory',
      'Santa Monica Pier',
      'Universal Studios Hollywood',
      'La Brea Tar Pits',
      'Petersen Automotive Museum',
      'California Science Center',
      'Natural History Museum of Los Angeles County',
      'Aquarium of the Pacific'
    ))
    or (destination_slug = 'new-york-city' and name in (
      'Central Park',
      'Statue of Liberty',
      'American Museum of Natural History',
      'Little Island',
      'Coney Island Boardwalk',
      'Governors Island',
      'Brooklyn Botanic Garden'
    ))
    or (destination_slug = 'toronto' and name in (
      'CN Tower',
      'Toronto Islands',
      'Royal Ontario Museum',
      'Ripley''s Aquarium of Canada',
      'Hockey Hall of Fame',
      'High Park',
      'Casa Loma',
      'Toronto Zoo',
      'Niagara Falls'
    ))
  );
