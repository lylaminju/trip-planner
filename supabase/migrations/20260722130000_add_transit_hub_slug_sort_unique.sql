-- Generated transit hubs can be inserted concurrently by parallel wizard
-- opens for the same destination; a unique key makes the duplicate insert
-- detectable so the first writer wins and the loser re-reads existing rows,
-- matching the contract ai_destination_candidates already has.
create unique index if not exists idx_ai_destination_transit_hubs_slug_sort
  on public.ai_destination_transit_hubs (destination_slug, sort_order);
