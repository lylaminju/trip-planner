-- Make one Google place appearing twice in a catalog impossible.
--
-- ai_destination_candidates was unique on (destination_slug, lower(name)) and
-- on (destination_slug, sort_order), so two rows describing the same place
-- under different names both persisted. The Hamilton catalog carried "HMCS
-- Haida National Historic Site" beside "HMCS Haida waterfront surroundings",
-- and "Battlefield House Museum & Park National Historic Site" beside "Stoney
-- Creek Battlefield House area"; each pair shared one google_place_id, so the
-- planner could schedule the same stop twice in a trip. Name uniqueness cannot
-- catch this, because the generator pads a catalog toward its target count by
-- re-describing places it has already listed.
--
-- The index is partial because google_place_id stays null until
-- scripts/backfill-candidate-place-ids.mjs resolves it, and any number of rows
-- may be waiting on that.

create unique index if not exists idx_ai_destination_candidates_slug_place_id
  on public.ai_destination_candidates (destination_slug, google_place_id)
  where google_place_id is not null;
