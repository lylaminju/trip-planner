update public.ai_destination_candidates
set
  tags = array_remove(
    array_remove(tags, 'kid-friendly'),
    'low-cost-free'
  ),
  updated_at = now()
where tags && array['kid-friendly', 'low-cost-free'];
