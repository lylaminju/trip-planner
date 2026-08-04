-- One AI-picked lunch stop per planned day when include_lunch_stop is on.
-- Budget tier and dietary answers steer the pick; they persist even while the
-- toggle is off so re-enabling keeps the traveler's answers.
alter table public.ai_planning_preferences
  add column if not exists include_lunch_stop boolean not null default false,
  add column if not exists dining_budget text,
  add column if not exists dietary_tags text[] not null default '{}',
  add column if not exists dietary_notes text;
