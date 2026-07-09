# TripGlance

A trip planning app for building dated itineraries from saved places, arranging visits by day and time, and viewing the plan on Google Maps. This app is deployed on Vercel.

## Features

- **Trip workspaces:** Create, edit, delete, and open trips with date ranges and role-based access through trip memberships.
- **Trip dashboard grouping:** Trips are grouped into Ongoing, Needs Dates, Upcoming, and Past sections using the viewer's current timezone.
- **Place library:** Save canonical places with name, address, Google Maps URL, coordinates, place notes, and reference links.
- **Repeated visits:** Add the same place to the itinerary multiple times as separate visits, each with its own date, time, and visit note.
- **Date buckets:** Itinerary items are grouped by date, sorted with timed visits first, and displayed with compact weekday labels.
- **Collapsible itinerary days:** Collapse or expand each date bucket independently to keep long itineraries manageable.
- **Unscheduled places:** Places that are not scheduled on any date are derived from the place library and shown separately.
- **Drag and drop scheduling:** Drag places into a date bucket, move scheduled visits between dates, reorder timed visits, or move visits back to Unscheduled.
- **Date-scoped place picker:** Use the `+` button on a date bucket to add existing places directly to that date.
- **Route segments:** Consecutive timed visits create route segment rows with selectable travel modes: walking, transit, bicycling, or driving.
- **Route detail controls:** Show or hide route segment rows, view cached route duration, and open a segment in Google Maps.
- **Itinerary export:** Copy or download scheduled itinerary details as Markdown.
- **Interactive Google Map:** Scheduled visits are shown as colored markers by day, with timed markers numbered to match the itinerary order.
- **Date, place, and route focus:** Selecting a date, place, or route segment in the planner moves the map to the matching places or route endpoints.
- **Unscheduled map markers:** Unscheduled places are shown on the map as gray markers.
- **Current location marker:** During an ongoing trip, users can toggle a compact blue current-location marker on the map.
- **Real route geometry:** When a server-side Google Routes API key is configured, route polylines use Google Routes geometry; otherwise the app falls back to straight lines.
- **Minimal route API usage:** Route geometry is cached by route endpoints and travel mode, so repeated renders do not keep calling Google Routes.
- **Responsive planner layout:** The planner supports desktop split view, expanded planner view, and mobile sheet states.
- **Google Maps saved-list import:** A legacy script imports places from a known shared Google Maps saved-list endpoint into the retained SQLite migration database.

## Tech Stack

- Next.js App Router
- React 19
- TypeScript
- Supabase Postgres
- Native CSS
- Google Maps JavaScript API
- Google Routes API, optional for real route polylines
- Vitest

## Getting Started

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_browser_google_maps_key
GOOGLE_MAPS_ROUTES_API_KEY=your_server_google_routes_key
OPENAI_API_KEY=your_server_openai_key
OPENAI_AI_PLANNER_MODEL=your_chosen_planner_model
```

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is used by the browser map. `GOOGLE_MAPS_ROUTES_API_KEY` is optional, but required for real route polylines. Without it, the map still renders markers and uses straight-line route fallbacks. `OPENAI_API_KEY` and `OPENAI_AI_PLANNER_MODEL` are required for AI itinerary generation.

Run the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Data Storage

The app stores runtime data in Supabase Postgres. Create a Supabase project, then run the SQL in `supabase/schema.sql` in the Supabase SQL editor.

Required environment variables:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=your_server_only_secret_key
# or, for legacy projects:
SUPABASE_SERVICE_ROLE_KEY=your_legacy_service_role_key
```

Use a server-only Supabase secret key if available, or the legacy service-role key. Do not expose either key in browser code.

The main tables are:

- `trips`: trip records with name, destination, and dates.
- `trip_memberships`: per-user trip access with `owner`, `editor`, or `viewer` roles.
- `places`: canonical place records.
- `itinerary_items`: scheduled visits that reference places.
- `route_segments`: travel-mode choices between consecutive timed itinerary items.
- `route_geometry_cache`: cached Google Routes API results.
- `ai_destination_candidates`: curated attraction candidates for supported AI planning destinations.

### AI Destination Candidate Counts

AI itinerary generation is intentionally constrained to curated rows in
`ai_destination_candidates`. The model receives candidate IDs and validation
rejects generated visits outside that list, which keeps plans grounded and
prevents arbitrary restaurants, duplicate attractions, or unsupported places
from entering generated itineraries.

Candidate counts should be sized from the largest itinerary the app is expected
to generate, plus some choice buffer:

```text
estimated visits = trip days x max visits/day
4 days x 5 visits/day = 20 visits
```

The current catalog targets about 30 candidates for large city destinations and
about 25 for Banff-style park destinations. That is enough for typical 3-5 day
trips at 2-5 visits per day while leaving alternatives for interests,
must-see selections, weather, geography, and lodging location. If the product
starts optimizing for longer trips, for example 7 days x 5 visits/day = 35
visits, expand the relevant destination catalog before relying on generated
plans for that trip length.

Existing deployments that predate trip memberships need a one-time backfill for
the default shared New York City trip. See
`docs/trip-membership-migration.md`.

## Hosting

The recommended deployment path is Supabase Postgres for data and Vercel for the Next.js app.

Hosted environment variables:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=your_server_only_secret_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_browser_google_maps_key
GOOGLE_MAPS_ROUTES_API_KEY=your_server_google_routes_key
OPENAI_API_KEY=your_server_openai_key
OPENAI_AI_PLANNER_MODEL=your_chosen_planner_model
```

## Importing A Google Maps Saved List

Run:

```bash
npm run import:google-list
TRIP_PLANNER_DEFAULT_TRIP_ID=1 npm run push:supabase
```

The importer reads the configured shared Google Maps saved-list endpoint in `scripts/import-google-list.mjs`, imports places into the legacy SQLite database, and keeps imported places unscheduled. Run `npm run push:supabase` afterward to move those imported rows into Supabase. See `docs/google-maps-saved-list-extraction.md` for details and caveats.

## Verification

Run tests:

```bash
npm test
```

Run a production build:

```bash
npm run build
```

Run TypeScript checking directly:

```bash
npx tsc --noEmit --pretty false
```

## Notes

- The saved-list importer uses an undocumented Google Maps endpoint and may need updates if Google changes the response format.
