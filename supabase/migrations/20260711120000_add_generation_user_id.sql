alter table public.ai_plan_generations
  add column if not exists created_by_user_id uuid
    references auth.users(id) on delete set null;

create index if not exists idx_ai_plan_generations_user_created
  on public.ai_plan_generations (created_by_user_id, created_at desc)
  where created_by_user_id is not null;
