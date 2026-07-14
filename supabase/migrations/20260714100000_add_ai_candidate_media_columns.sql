-- Add thumbnail + description fields to AI destination candidates so the
-- "Must-sees" wizard step can show users what each place is before selecting.
-- Images are sourced once from Wikimedia and stored in Supabase Storage; only
-- the resulting public URL, credit line, and blurb live in this table.
alter table public.ai_destination_candidates
  add column if not exists blurb text;

alter table public.ai_destination_candidates
  add column if not exists image_url text;

alter table public.ai_destination_candidates
  add column if not exists image_credit text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_destination_candidates_blurb_not_blank'
      and conrelid = 'public.ai_destination_candidates'::regclass
  ) then
    alter table public.ai_destination_candidates
      add constraint ai_destination_candidates_blurb_not_blank
      check (blurb is null or btrim(blurb) <> '');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_destination_candidates_image_url_not_blank'
      and conrelid = 'public.ai_destination_candidates'::regclass
  ) then
    alter table public.ai_destination_candidates
      add constraint ai_destination_candidates_image_url_not_blank
      check (image_url is null or btrim(image_url) <> '');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_destination_candidates_image_credit_not_blank'
      and conrelid = 'public.ai_destination_candidates'::regclass
  ) then
    alter table public.ai_destination_candidates
      add constraint ai_destination_candidates_image_credit_not_blank
      check (image_credit is null or btrim(image_credit) <> '');
  end if;
end;
$$;
