-- Introduce the `shopping` interest tag and curate existing candidates.
-- Tags retail-focused districts and streets so the new wizard option returns
-- at least one candidate per seeded destination. Market/food-hall candidates
-- keep their `food` tag and are only tagged `shopping` when retail is a genuine
-- draw (e.g. Kensington Market's vintage shops).

update public.ai_destination_candidates
set tags = array_append(tags, 'shopping'), updated_at = now()
where not ('shopping' = any(tags))
  and (
    (destination_slug = 'banff-national-park' and name in ('Banff Avenue'))
    or (destination_slug = 'iceland' and name in ('Laugavegur Shopping Street'))
    or (destination_slug = 'los-angeles' and name in (
      'The Grove and Original Farmers Market'
    ))
    or (destination_slug = 'new-york-city' and name in (
      'SoHo Cast Iron Historic District'
    ))
    or (destination_slug = 'toronto' and name in (
      'Yorkville',
      'Distillery District',
      'Kensington Market'
    ))
  );
