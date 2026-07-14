-- The "Reykjavik" destination was replaced by the wider "Iceland" destination.
-- Repoint existing trips from the retired slug/label so their cover and map
-- framing resolve to Iceland. Matches rows already tagged with the old slug,
-- plus any pre-backfill trips whose destination text is still "Reykjavik".
update public.trips
set
  destination = 'Iceland',
  destination_slug = 'iceland'
where destination_slug = 'reykjavik'
   or (destination_slug is null and lower(btrim(destination)) = 'reykjavik');
