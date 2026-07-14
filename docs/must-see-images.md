# Must-See Thumbnails & Descriptions

Use this guide when adding or replacing the thumbnail image and blurb shown for
each must-see candidate in the AI planning wizard (Step 5).

## Goal

Every must-see candidate should be recognizable at a glance: a small landmark
photo plus a one-line description, so a traveler who doesn't know the place can
still decide whether to lock it in. Images are sourced once and stored in
Supabase Storage — never committed to the repo.

## Where It Lives

- **Table:** `public.ai_destination_candidates`
  - `blurb` — one-line description (≤ 240 chars)
  - `image_url` — public URL of the stored thumbnail
  - `image_credit` — attribution line (required for Wikimedia images)
- **Storage bucket:** `candidate-images` (public), object path
  `{destination_slug}/{candidate_id}.webp`, content type `image/webp`.
- **Script:** `scripts/backfill-candidate-images.mjs`
  (`npm run backfill:candidate-images`).
- **Schema migration:** `supabase/migrations/20260714100000_add_ai_candidate_media_columns.sql`.

A candidate with no `image_url` cleanly falls back to a map-pin icon in the
card, so partial coverage is fine.

## Prerequisites

1. The media-columns migration is applied to the target database:

   ```sh
   supabase db push        # applies 20260714100000_add_ai_candidate_media_columns.sql
   ```

2. `.env.local` has service credentials (same ones `push:supabase` uses):

   ```sh
   SUPABASE_URL=...
   SUPABASE_SECRET_KEY=...        # or SUPABASE_SERVICE_ROLE_KEY
   ```

The script creates the public `candidate-images` bucket automatically on first
run.

## Option A — Automated backfill from Wikimedia (recommended)

Sources a lead image + intro for each candidate from Wikipedia/Wikimedia,
compresses it to a 480 px WebP thumbnail, uploads it to Storage, and writes
`image_url`, `image_credit`, and `blurb` back to the row.

```sh
npm run backfill:candidate-images                      # all destinations
npm run backfill:candidate-images -- --destination=iceland   # one destination
npm run backfill:candidate-images -- --force           # re-fetch rows that already have an image
npm run backfill:candidate-images -- --reclean-blurbs  # re-clean stored blurbs only (no network/images)
```

Behavior worth knowing:

- **Idempotent.** Without `--force`, only rows missing `image_url` are fetched,
  so re-running safely fills gaps.
- **Fails closed.** A place with no Wikimedia lead image is skipped (logged as
  `- skip`) and keeps the map-pin fallback; one failure never aborts the batch.
- **Blurbs are cleaned** at ingestion — native-name / IPA pronunciation glosses
  are stripped and text is capped at 240 chars.
- **Rate limits.** Wikimedia throttles bots with HTTP 429; the script backs off
  (honoring `Retry-After`) and paces requests. If you still see 429 failures on
  a large run, wait a few minutes and re-run — it resumes only the missing rows.

## Option B — Add or replace one item manually

Use this for places Wikimedia can't cover, or when you have a better licensed
image.

1. Get a licensed image (see **Licensing** below) and convert to WebP at ~480 px
   wide:

   ```sh
   cwebp -quiet -q 80 -resize 480 0 /tmp/source.jpg -o /tmp/{candidate_id}.webp
   ```

2. Upload it to the `candidate-images` bucket at path
   `{destination_slug}/{candidate_id}.webp` (Supabase dashboard → Storage, or the
   CLI). The public URL is:

   ```
   https://{project}.supabase.co/storage/v1/object/public/candidate-images/{destination_slug}/{candidate_id}.webp
   ```

3. Update the row (SQL, or via the Supabase table editor):

   ```sql
   update public.ai_destination_candidates
   set image_url    = 'https://{project}.supabase.co/storage/v1/object/public/candidate-images/iceland/119.webp',
       image_credit = 'Photographer Name (CC BY-SA 4.0), via Wikimedia Commons',
       blurb        = 'One-line description, under 240 characters.',
       updated_at   = now()
   where destination_slug = 'iceland'
     and lower(name) = lower('National Museum of Iceland');
   ```

Leave `image_credit` null only for your own original photos.

## Adding brand-new must-see candidates

To add must-sees for a new destination (or new places in an existing one):

1. Add a seed migration following the existing pattern
   (`supabase/migrations/*_seed_*_ai_destination_candidates.sql`) with the core
   fields (`destination_slug`, `name`, `category`, `tags`, `area`,
   `region_distance_tier`, `sort_order`, `latitude`, `longitude`,
   `typical_duration_minutes`, `indoor_outdoor`). Leave `image_url` / `blurb`
   null.
2. `supabase db push`.
3. Backfill just that destination:
   `npm run backfill:candidate-images -- --destination={slug}`.
4. Fill any skipped rows manually via **Option B**.

## Licensing & Attribution

Prefer Wikimedia Commons / Wikipedia images — license metadata is stable and the
backfill captures it automatically. Allowed licenses: **Public domain, CC0,
CC BY, CC BY-SA**. Do **not** use NC/ND, unknown/missing-license, watermarked, or
commercial-site images. When adding an image manually, record the credit in
`image_credit` as `Author (License), via Wikimedia Commons`.

## Verification

After changing images or blurbs:

- Spot-check coverage and a sample row, e.g. in the Supabase table editor confirm
  `image_url` resolves and `blurb` reads cleanly (no `[IPA]` / `(Language: …)`
  clutter).
- Open the wizard (`npm run dev` → **Plan with AI** → Step 5) and confirm
  thumbnails load and missing ones show the map-pin fallback.
- If you changed the parsing/blurb logic in the script, run its tests:

  ```sh
  npm test -- tests/candidate-image-parsing.test.mjs
  ```
