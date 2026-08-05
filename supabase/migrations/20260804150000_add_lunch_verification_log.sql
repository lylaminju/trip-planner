-- Per-day lunch verification outcomes (candidate results, chosen index,
-- details-call count), recorded per generation so the decision to expand the
-- lunch candidate cap can be made from real outcome distributions. Null when
-- lunch stops were off or the run was a guest generation.
alter table public.ai_plan_generations
  add column if not exists lunch_verification_log jsonb;
