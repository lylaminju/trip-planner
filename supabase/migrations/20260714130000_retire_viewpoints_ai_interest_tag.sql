-- Retire the `viewpoints` interest tag. It was always a refinement tag that
-- co-occurred with other interests (no candidate relied on it as its only
-- interest), so removing it orphans nothing. Strip the orphaned strings from
-- candidates and saved trip preferences so no stale tag lingers.

update public.ai_destination_candidates
set tags = array_remove(tags, 'viewpoints'), updated_at = now()
where 'viewpoints' = any(tags);

update public.ai_planning_preferences
set interest_tags = array_remove(interest_tags, 'viewpoints'), updated_at = now()
where 'viewpoints' = any(interest_tags);
