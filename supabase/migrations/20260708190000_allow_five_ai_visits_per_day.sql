alter table public.ai_planning_preferences
  drop constraint if exists ai_planning_preferences_visit_range_valid;

alter table public.ai_planning_preferences
  add constraint ai_planning_preferences_visit_range_valid
    check (
      visits_per_day_min between 1 and 5
      and visits_per_day_max between 1 and 5
      and visits_per_day_min <= visits_per_day_max
    );
