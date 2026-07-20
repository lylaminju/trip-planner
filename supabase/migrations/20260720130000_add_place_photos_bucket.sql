-- Public bucket for place photos fetched when a place is added from search or
-- the map. The image is fetched from Google once at add time and served from
-- our own bucket afterwards, so viewing places never re-bills the Place Photo
-- SKU. Uploads happen via the service role (which bypasses storage RLS); the
-- public bucket serves the stored image without further policies.
insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', true)
on conflict (id) do nothing;
