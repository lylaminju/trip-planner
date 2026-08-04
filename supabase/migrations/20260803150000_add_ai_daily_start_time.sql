-- The hour each planned day starts from lodging. Previously a per-request
-- generation field only, so reopening the wizard always fell back to 09:00.
alter table public.ai_planning_preferences
  add column if not exists daily_start_time time not null default '09:00';
