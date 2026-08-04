-- Follow-up to 20260803130000. The planner cites a source as
-- "([example.com](https://example.com/x))", so stripping only the markdown left
-- the label behind as a bare domain in parentheses: the link written out, one
-- step removed from the syntax that migration set out to remove. The URL is
-- already on places.links, so the citation goes.
--
-- Only a parenthetical holding nothing but a domain is removed, so prose like
-- "(a.k.a. AGH)" or "(Mon-Fri)" is untouched. Scoped to created_by_source =
-- 'ai' like the migration that created these notes.

create or replace function pg_temp.note_without_citations(p_notes text)
returns text
language sql
immutable
as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          p_notes,
          -- The leading whitespace goes too, so a trailing citation leaves the
          -- sentence's own punctuation flush and a mid-sentence one closes up.
          '\s*\((?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\)',
          '',
          'gi'
        ),
        '[ \t]{2,}',
        ' ',
        'g'
      )
    ),
    ''
  )
$$;

update public.places
set
  notes = pg_temp.note_without_citations(notes),
  updated_at = now()
where created_by_source = 'ai'
  and notes ~* '\((?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\)';

update public.itinerary_items
set
  notes = pg_temp.note_without_citations(notes),
  updated_at = now()
where created_by_source = 'ai'
  and notes ~* '\((?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\)';
