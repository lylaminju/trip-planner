# Trip Planner MVP Design

Date: 2026-05-19

## Context

This project is a local-first trip planning web app for two technically comfortable users. The current repository contains requirements, a Google Maps saved-list extraction note, and an importer script. A reference SQLite database exists at `/Users/mjuup/Projects/trip-planner-mvp/data/trip-planner.sqlite`; it contains 49 imported destinations, no scheduled dates, no route segments, partial addresses, long user-facing notes, no official Google Places API IDs, and Google internal IDs for all rows.

The MVP should optimize for local development speed and clear behavior. It should not add multi-trip support, authentication, duplicate visit support, hosted deployment assumptions, or Google route geometry.

## Requirement Assessment

The overall requirements are reasonable for a local/serverful MVP:

- Next.js App Router, React, TypeScript, native CSS, SQLite, and `better-sqlite3` fit a local app well.
- Google Maps JavaScript API is appropriate for the interactive map.
- Straight in-app polylines are enough for planning structure.
- Google Maps route handoff is better than implementing live routing in the MVP.
- SQLite plus `better-sqlite3` is not appropriate for Vercel-style serverless persistent writes, but it is appropriate for local use and later self-hosting on a mini PC, VPS, or other serverful environment.

The initial requirement to use `sort_order` was revised. The approved MVP does not use `sort_order`; itinerary order is controlled by visit time.

## Approved Direction

Use a local-first, single-trip MVP:

- One SQLite database.
- No auth.
- One current trip.
- One row per physical place.
- The same physical place cannot be visited more than once.
- Manual itinerary order is not supported in the MVP.
- Drag-and-drop changes date assignment only.

Future expansion can add `trips` and `itinerary_items` when multi-trip support or duplicate visits become necessary.

## Architecture

Use Next.js App Router with React 19 and TypeScript.

Server-side code owns all SQLite access. The browser should never open SQLite directly. Use route handlers, server actions, or server-only modules as the boundary around `better-sqlite3`.

The UI has two primary panes:

- Left panel: place controls, itinerary days, unscheduled places, route segment controls, raw places list, edit/delete actions.
- Right panel: Google map, markers, straight polylines, active selection, and fallback coordinates when the browser map key is missing.

Google Maps has two separate roles:

- Browser map rendering uses `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
- External route checking uses Google Maps URLs opened from itinerary segment buttons.

## Data Model

### `places`

`places` stores imported metadata, user-editable metadata, coordinates, and planning fields.

```sql
CREATE TABLE places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  google_maps_url TEXT NOT NULL,
  place_id TEXT,
  google_place_token TEXT,
  google_internal_ids TEXT,
  source_list_url TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  visit_date TEXT,
  visit_time TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Field notes:

- `name` is required. It should be auto-filled from a Google Maps URL when possible and manually required when auto-fill fails.
- `google_maps_url` is required for manually added places.
- `latitude` and `longitude` are required because every saved place must be renderable on the map.
- `visit_date` and `visit_time` are optional. Store `visit_date` as `YYYY-MM-DD` and `visit_time` as local `HH:mm`.
- `name`, `address`, and `notes` are user-editable and should be preserved by importer updates.
- `place_id`, `google_place_token`, `google_internal_ids`, and `source_list_url` are source identity fields.

### `route_segments`

`route_segments` stores user-selected travel mode for valid consecutive timed places.

```sql
CREATE TABLE route_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  to_place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'walking'
    CHECK (mode IN ('walking', 'transit', 'bicycling', 'driving')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Do not add `UNIQUE(from_place_id, to_place_id)` in the MVP. Application reconciliation should still maintain at most one active segment row for each current valid `from_place_id -> to_place_id` pair.

Do not store `visit_date` on `route_segments`; segment date can be inferred by joining `places`, and storing it would duplicate state. A valid segment must join to two places with the same non-null `visit_date` and non-null `visit_time`.

## Ordering And Route Reconciliation

Places are grouped by `visit_date`.

Inside a scheduled day:

1. Timed places appear first.
2. Timed places are ordered by `visit_time ASC`, then `name ASC`.
3. Places with a date but no time appear after timed places.
4. Untimed places are ordered by `name ASC`.

Unscheduled places have no `visit_date` and appear in the unscheduled section.

Route segments are generated only from places that have both `visit_date` and `visit_time`.

For each date:

1. Select only timed places for that date.
2. Sort by `visit_time ASC`, then `name ASC`.
3. Create segments between consecutive timed places only.

Examples:

```text
09:00 A
11:00 B
(no time) Central Park
(no time) Guggenheim
```

Visible itinerary order:

```text
A
B
Central Park
Guggenheim
```

Route segments:

```text
A -> B
```

No segment is created to or from an untimed place.

Reconciliation should run after mutations that can affect valid segments:

- Add place with both date and time.
- Edit date or time.
- Delete place.
- Drag a place between date buckets.
- Drag a place to unscheduled.

Reconciliation behavior:

- Preserve `mode` when the same `from_place_id -> to_place_id` pair remains valid.
- Insert newly valid pairs with default `walking`.
- Delete pairs that are no longer consecutive timed places.
- Delete pairs involving unscheduled or untimed places.
- Deduplicate accidental repeated rows for the same current valid pair during reconciliation.

## Core Mutations

### Add Place

Manual add requires a Google Maps URL.

Flow:

1. User enters `google_maps_url`.
2. Server resolves short links when necessary.
3. Server extracts coordinates from the resolved URL or page data.
4. Server auto-fills `name` when possible.
5. If `name` cannot be auto-filled, user must enter it.
6. Save only when `name`, `google_maps_url`, `latitude`, and `longitude` are available.
7. Reconcile routes if the saved place has both `visit_date` and `visit_time`.

Plain text place search and autocomplete are out of scope for the MVP.

### Edit Place

Users can edit:

- `name`
- `address`
- `notes`
- `google_maps_url`
- `visit_date`
- `visit_time`

If `google_maps_url` changes, re-resolve coordinates. If resolution fails, do not save invalid coordinates.

For imported rows, `google_maps_url` is editable in the form but treated as source/link metadata during import. A later confident import match may overwrite it with the URL derived from the saved-list source.

Date/time edits can change route topology because itinerary order is time-driven.

### Delete Place

Each place row should have a small delete button.

Deleting a place removes it from `places`. Foreign keys with `ON DELETE CASCADE` remove related route segments. Reconcile affected days after deletion.

Hard delete is enough for the MVP. If a deleted imported place still exists in the Google saved list, a later import can re-add it.

### Drag And Drop

Drag-and-drop changes date assignment only; it does not reorder places within a day.

Rules:

- The raw Places section is not reorderable.
- Unscheduled places can be dragged into an itinerary date bucket.
- Scheduled places can be dragged between itinerary date buckets.
- Dropping an unscheduled place onto a date sets `visit_date` and leaves `visit_time = NULL`.
- Dropping a scheduled place onto another date updates `visit_date` and preserves `visit_time`.
- Dropping a scheduled place into unscheduled clears both `visit_date` and `visit_time`.
- Reconcile routes after each date assignment change.

### Change Route Mode

Segment mode values should use official Google Maps URL travel mode names:

- `walking`
- `transit`
- `bicycling`
- `driving`

Changing a segment mode updates only `route_segments.mode`.

## Importer Behavior

The importer is CLI-only for the MVP. It should be run from the terminal, for example through an npm script, and should not appear as a web page, modal, or button in the app UI.

The importer should add/update imported places while preserving user-editable fields and planning fields.

Preserve on existing rows:

- `name`
- `address`
- `notes`
- `visit_date`
- `visit_time`

Update source/identity/location fields on confident matches:

- `google_maps_url`
- `place_id`
- `google_place_token`
- `google_internal_ids`
- `source_list_url`
- `latitude`
- `longitude`

Matching priority:

1. `place_id`, when present.
2. `google_place_token`, when present.
3. `google_internal_ids`, when present.
4. Conservative fallback matching for rows without stable Google identity.

If the importer cannot confidently match an existing row, it should insert a new unscheduled place rather than risk overwriting user-edited metadata.

The current Google saved-list endpoint is undocumented and may change. The importer should remain a seed/sync utility, not a hard product dependency.

## UI Design

### Left Panel

The left panel contains controls and lists.

Add Place:

- Button opens a modal.
- Modal starts with Google Maps URL.
- Resolution prefills name/address/coordinates when possible.
- If name cannot be resolved, user must provide it.
- Date, time, address, and notes are optional editable fields.

Itineraries:

- Group places by `visit_date`.
- Each date has a consistent color.
- Timed places appear before untimed places.
- Segment rows appear only between consecutive timed places.
- Segment row includes a travel mode selector.
- Segment row includes a small "Open in Google Maps" button.

Unscheduled:

- Shows places with no `visit_date`.
- Items can be dragged into itinerary date buckets.

Places:

- Raw list of all places.
- Not reorderable.
- Click row to select and pan/highlight map marker.
- Each row has edit and delete controls.

### Right Panel

The right panel contains the map.

Behavior:

- Render Google Maps asynchronously.
- Show markers for all places with coordinates.
- Marker colors match date groups.
- Unscheduled places use a neutral marker color.
- Render straight polylines only for valid route segments.
- Clicking a marker or list row selects the place and pans/highlights the map.
- Clicking a polyline selects/highlights the segment but does not open a new tab.
- If `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is missing, show a coordinate/list fallback.

## Google Maps Route Handoff

The itinerary segment row has a small "Open in Google Maps" button.

The button immediately opens a new tab using a stable Maps URL:

```text
https://www.google.com/maps/dir/?api=1&origin=<from_lat>,<from_lng>&destination=<to_lat>,<to_lng>&travelmode=<mode>
```

Use the stored segment mode directly:

- `walking`
- `transit`
- `bicycling`
- `driving`

Do not try to construct Google's long internal `/data=!3m...` route URLs.

## Error Handling

URL resolution:

- If a Google Maps URL cannot produce coordinates, show a clear error and do not save.
- If name cannot be resolved, require manual name entry.
- If URL changes during edit and cannot be resolved, keep the user on the form with the error.

Map rendering:

- If browser map API key is missing, show coordinate/list fallback.
- If map script fails to load, show the same fallback.

Importer:

- Preserve user-editable fields on matched rows.
- Insert a new unscheduled row when matching is not confident.
- Treat Google saved-list payload shape as unstable.

Route reconciliation:

- Remove invalid segments after date/time/delete changes.
- Preserve mode only for unchanged valid pairs.

## Testing Strategy

Unit tests should cover:

- Itinerary sorting: timed places first, untimed places last, name tie-breakers.
- Route reconciliation: consecutive timed places only.
- Route reconciliation: no segments involving untimed or unscheduled places.
- Route reconciliation: preserve mode for unchanged pairs.
- Route reconciliation: delete invalid pairs after time/date changes.
- Drag/drop mutation rules: moving to date, moving between dates, moving to unscheduled.
- Google Maps route URL generation.
- Importer matching and preservation rules.

Integration or manual tests should cover:

- Add place from Google Maps URL.
- Auto-fill name when possible and require name when not possible.
- Edit date/time and verify route segment updates.
- Delete a place and verify segment cleanup.
- Move scheduled and unscheduled places through drag-and-drop.
- Open a Google Maps route from an itinerary segment.
- Load app without browser Maps API key and verify fallback.

## Out Of Scope For MVP

- Authentication.
- Multi-trip support.
- Duplicate visits to the same physical place.
- Manual ordering within a day.
- `sort_order`.
- Google Places plain text search.
- Autocomplete.
- Real route geometry or live duration inside the app.
- Hosted/serverless deployment.
- Hidden/deleted imported-place suppression.

## Future Expansion

Likely future migrations:

- Add `trips` table when multiple trips are needed.
- Split `places` from `itinerary_items` when duplicate visits or reusable place library support is needed.
- Add deleted-import suppression if users want removed saved-list places to stay removed after import.
- Add route geometry/duration caching if in-app route accuracy becomes necessary.
- Add hosted database or serverful deployment packaging when moving beyond local use.
