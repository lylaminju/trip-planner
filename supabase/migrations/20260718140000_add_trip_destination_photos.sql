-- Store a single Google Places photo per trip destination. The image is fetched
-- once at trip creation and served from our own bucket, so viewing trips never
-- re-bills the Place Photo SKU.
alter table public.trips
  add column if not exists destination_photo_url text,
  add column if not exists destination_photo_attribution text;

-- Allow the photo SKU on the usage ledger alongside autocomplete and details.
alter table public.google_places_api_calls
  drop constraint if exists google_places_api_calls_sku_check;
alter table public.google_places_api_calls
  add constraint google_places_api_calls_sku_check
  check (sku in ('autocomplete', 'details', 'photo'));

-- Public bucket for destination cover photos. Uploads happen via the service
-- role (which bypasses storage RLS); the public bucket serves the stored image
-- on trip cards without further policies.
insert into storage.buckets (id, name, public)
values ('trip-destination-photos', 'trip-destination-photos', true)
on conflict (id) do nothing;
