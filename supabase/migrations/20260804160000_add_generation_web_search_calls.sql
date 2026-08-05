-- Web searches the primary planner call actually executed (action type and
-- query per call), so how the model spends its capped search budget is
-- observable per generation. Empty array = tool attached but unused; null =
-- tool never attached (guest generations).
alter table public.ai_plan_generations
  add column if not exists web_search_calls jsonb;
