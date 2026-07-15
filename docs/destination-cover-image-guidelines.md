# Destination Cover Image Guidelines

Use this guide when adding or replacing images in `public/city-covers`.

## Goal

Each destination cover should be a legally reusable, visually clear image that
quickly communicates the destination. Prefer landmark, skyline, waterfront,
historic district, or iconic natural-setting images over generic street scenes.

## Repository Contract

- Image files live at `public/city-covers/{slug}.webp`.
- Attribution metadata lives in `public/city-covers/attributions.json`.
- Destination source data lives in `src/data/destinations.ts`.
- Cover slugs are exactly the `DESTINATIONS` slugs. There is no separate cover
  list; `destinationImagePath` in `src/lib/destination-options.ts` derives each
  path from the slug.
- Do not change destination matching behavior or reintroduce alias fields as
  part of image work.

## Source Rules

Prefer Wikimedia Commons or Wikipedia-hosted images because license metadata is
machine-readable and stable.

Allowed licenses:

- Public domain
- CC0
- CC BY
- CC BY-SA

Do not use:

- Unknown, missing, or ambiguous licenses
- NC or ND licenses
- Watermarked images
- Travel-blog, tourism-site, or commercial-site images unless the page clearly
  grants a compatible reusable license
- Screenshots, maps, flags, logos, PDFs, or illustrations as destination covers
- Images with obvious rights restrictions that conflict with reuse

If a user provides an attractive non-Commons image, verify its reuse license
before adding it. If the license is not clear, do not add it; recommend a
Commons-safe substitute instead.

## Selection Criteria

Pick images that work as destination cards, not just as encyclopedia images.

Strong candidates:

- Show a landmark people associate with the destination
- Remain recognizable after center-cropping in a card
- Have enough horizontal context for a wide cover
- Are at least 1400 px wide after download/conversion
- Avoid tiny or dominant foreground objects unless they are the landmark
- Avoid busy close-ups, interiors, or people-focused images unless the
  destination is best represented that way

Useful query patterns:

- `{destination} skyline file`
- `{destination} landmark file`
- `{destination} waterfront file`
- `{destination} old town file`
- `{destination} {specific landmark} file`

Do not rely blindly on Wikipedia page images. They can be flags, maps, portraits,
or weak crops. Search targeted Commons candidates and compare them.

## Commons Metadata Lookup

Use the Commons API with a clear user agent when possible.

Search candidates:

```sh
curl -sS "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=Singapore%20Marina%20Bay%20skyline%20file&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiurlwidth=1920&format=json&origin=*"
```

Fetch one file's metadata:

```sh
curl -sS "https://commons.wikimedia.org/w/api.php?action=query&titles=File:Belvedere,_Vienna_September_2016.jpg&prop=imageinfo&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiurlwidth=1920&format=json&origin=*"
```

Confirm these fields before using the image:

- `thumburl` or `url`
- `width` and `height`
- `ObjectName`
- `Artist`
- `Credit`
- `LicenseShortName`
- `LicenseUrl`
- `UsageTerms`
- `descriptionurl`

## Download And Convert

Prefer the 1920 px derivative from `thumburl`, then convert to WebP at 1400 px
wide. Do not upscale smaller sources.

Basic conversion:

```sh
cwebp -quiet -q 82 -resize 1400 0 /tmp/source.jpg -o public/city-covers/{slug}.webp
```

If a user asks for a crop, crop before resizing:

```sh
cwebp -quiet -q 82 -crop 0 0 1740 1108 -resize 1400 0 /tmp/source.jpg -o public/city-covers/{slug}.webp
```

After conversion, verify dimensions:

```sh
file public/city-covers/{slug}.webp
```

## Attribution Entry Shape

Keep one entry per cover image in `public/city-covers/attributions.json`.
Entries must stay in the same order as `DESTINATIONS`, which is alphabetical by
name. `tests/destination-options.test.ts` asserts the two orders are equal.

```json
{
  "slug": "vienna",
  "label": "Vienna",
  "sourcePage": "https://en.wikipedia.org/wiki/Vienna",
  "commonsTitle": "File:Belvedere, Vienna September 2016.jpg",
  "file": "/city-covers/vienna.webp",
  "downloadedFrom": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Belvedere%2C_Vienna_September_2016.jpg/1920px-Belvedere%2C_Vienna_September_2016.jpg",
  "width": 1400,
  "height": 746,
  "attribution": {
    "objectName": "Belvedere, Vienna September 2016",
    "artist": "Martin Falbisoner",
    "credit": "Own work",
    "licenseShortName": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "usageTerms": "Creative Commons Attribution-Share Alike 4.0",
    "descriptionUrl": "https://commons.wikimedia.org/wiki/File:Belvedere,_Vienna_September_2016.jpg"
  }
}
```

## Replacement Workflow

When replacing one existing cover:

1. Fetch metadata for the new source.
2. Download the source derivative to `/private/tmp` or another temp location.
3. Convert to `public/city-covers/{slug}.webp`.
4. Update only that slug's attribution entry.
5. Verify dimensions in metadata match the actual WebP.
6. Run `npm test -- tests/destination-options.test.ts`.
7. Visually inspect the new cover.
8. Delete temporary source files after the commit is complete.

When adding covers for many destinations:

1. Compare `DESTINATIONS` with the files in `public/city-covers`.
2. Pick and verify licensed sources for missing slugs.
3. Generate WebP files.
4. Regenerate or update `attributions.json` in `DESTINATIONS` order.
5. Run `npm test` and `npx tsc --noEmit`.
6. Spot-check the visually riskiest covers.
7. Delete temporary scripts, source images, and caches after commit.

## Verification Checklist

Before calling image work complete:

- Every slug in `DESTINATIONS` has a matching WebP file.
- Every cover has an attribution entry.
- `downloadedFrom` is an HTTP(S) URL.
- `artist`, `licenseShortName`, and `usageTerms` are present.
- Attribution dimensions match the actual WebP dimensions.
- No selected image is a flag, map, logo, PDF page, or unclear-license file.
- The targeted destination test passes:

```sh
npm test -- tests/destination-options.test.ts
```

For broad cover changes, also run:

```sh
npm test
npx tsc --noEmit
```
