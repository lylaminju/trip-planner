-- The dining feature meters lunch verification under the new 'text_search_enterprise'
-- SKU, but the sku CHECK predates it, so every recordPlacesCall insert failed
-- and the enrichment discarded successful Google verifications as unverified.
alter table public.google_places_api_calls
  drop constraint if exists google_places_api_calls_sku_check;
alter table public.google_places_api_calls
  add constraint google_places_api_calls_sku_check
  check (sku in ('autocomplete', 'details', 'photo', 'text_search_enterprise'));
