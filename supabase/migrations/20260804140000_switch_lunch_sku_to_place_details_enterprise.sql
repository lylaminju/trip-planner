-- v7 lunch selection resolves candidates via the free IDs-only search and
-- fetches Place Details Enterprise, replacing the never-used Text Search
-- Enterprise SKU (zero rows were ever recorded under it).
alter table public.google_places_api_calls
  drop constraint if exists google_places_api_calls_sku_check;
alter table public.google_places_api_calls
  add constraint google_places_api_calls_sku_check
  check (sku in ('autocomplete', 'details', 'photo', 'place_details_enterprise'));
