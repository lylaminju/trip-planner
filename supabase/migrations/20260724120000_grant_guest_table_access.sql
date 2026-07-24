-- The guest tables were created without explicit grants, and this database
-- does not grant new tables to service_role by default (matching
-- 20260711130000, which needed the same grants for google_routes_api_calls).
-- Without them PostgREST returns 403 for every guest quota and analytics
-- query.

grant all on public.guest_api_usage to service_role;
grant usage, select on sequence public.guest_api_usage_id_seq to service_role;

grant all on public.guest_events to service_role;
grant usage, select on sequence public.guest_events_id_seq to service_role;
