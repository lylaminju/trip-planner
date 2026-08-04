-- Notes render as plain text, so the `[label](url)` markdown the AI planner
-- wrote into a visit note showed as raw syntax ("Art Gallery of Hamilton" among
-- them). Rows already stored are rewritten the way generation now writes them
-- (src/lib/note-links.ts): the note keeps the link label as prose, and the URL
-- moves onto places.links with its utm_source tag dropped.
--
-- Scoped to created_by_source = 'ai'. Notes a member typed are left alone even
-- if they happen to contain the same syntax.

create or replace function pg_temp.note_without_markdown_links(p_notes text)
returns text
language sql
immutable
as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          p_notes,
          '\[([^\]]*)\]\(\s*([^()\s]+)\s*\)',
          '\1',
          'g'
        ),
        -- Removing a link can leave the gap its surrounding spaces used to fill.
        '[ \t]{2,}',
        ' ',
        'g'
      )
    ),
    ''
  )
$$;

create or replace function pg_temp.note_link_urls(p_notes text)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(distinct cleaned.url), '{}'::text[])
  from regexp_matches(
    coalesce(p_notes, ''),
    '\[[^\]]*\]\(\s*(https?://[^()\s]+)\s*\)',
    'g'
  ) as matched(parts)
  cross join lateral (
    select regexp_replace(
      -- Drop the tracking parameter, then the separator it may have left
      -- stranded before the fragment or the end of the URL.
      regexp_replace(matched.parts[1], '([?&])utm_source=[^&#]*&?', '\1', 'gi'),
      '[?&](#|$)',
      '\1'
    ) as url
  ) cleaned
$$;

update public.places
set
  -- A markdown link whose URL is not a plain web URL still loses its markdown
  -- above, so the merged set can stay empty and links is not null.
  links = coalesce(
    (
      select array_agg(distinct link)
      from unnest(links || pg_temp.note_link_urls(notes)) as merged(link)
    ),
    '{}'::text[]
  ),
  notes = pg_temp.note_without_markdown_links(notes),
  updated_at = now()
where created_by_source = 'ai'
  and notes ~ '\[[^\]]*\]\([^()\s]+\)';

update public.itinerary_items
set
  notes = pg_temp.note_without_markdown_links(notes),
  updated_at = now()
where created_by_source = 'ai'
  and notes ~ '\[[^\]]*\]\([^()\s]+\)';
