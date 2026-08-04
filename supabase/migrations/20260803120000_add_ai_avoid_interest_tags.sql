-- Interests the traveler wants kept out of AI itineraries. Disjoint from
-- interest_tags (the API rejects overlap); must-see picks override it per place.
alter table public.ai_planning_preferences
  add column if not exists avoid_interest_tags text[] not null default '{}';
