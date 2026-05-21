# Trip Planner

A trip planning app for building dated itineraries from saved places, arranging visits by day and time, and viewing the plan on Google Maps. This app is deployed on Vercel.

## Features

- **Place library:** Save canonical places with name, address, Google Maps URL, coordinates, and place-level notes.
- **Repeated visits:** Add the same place to the itinerary multiple times as separate itinerary items, each with its own date, time, and visit note.
- **Date buckets:** Itinerary items are grouped by date, sorted with timed visits first, and displayed with the day of week.
- **Unscheduled places:** Places that are not scheduled on any date are derived from the place library and shown separately.
- **Drag and drop scheduling:** Drag places into a date bucket, move scheduled visits between dates, or move visits back to Unscheduled.
- **Date-scoped place picker:** Use the `+` button on a date bucket to open a sidecar picker and add existing places directly to that date.
- **Route segments:** Consecutive timed visits create route segment rows with selectable travel modes: walking, transit, bicycling, or driving.
- **Interactive Google Map:** Scheduled visits are shown as colored markers by day, with timed markers numbered to match the itinerary order.
- **Unscheduled map markers:** Unscheduled places are shown on the map as gray markers.
- **Real route geometry:** When a server-side Google Routes API key is configured, route polylines use Google Routes geometry; otherwise the app falls back to straight lines.
- **Minimal route API usage:** Route geometry is cached by route endpoints and travel mode, so repeated renders do not keep calling Google Routes.
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
```

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is used by the browser map. `GOOGLE_MAPS_ROUTES_API_KEY` is optional, but required for real route polylines. Without it, the map still renders markers and uses straight-line route fallbacks.

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

- `places`: canonical place records.
- `itinerary_items`: scheduled visits that reference places.
- `route_segments`: travel-mode choices between consecutive timed itinerary items.
- `route_geometry_cache`: cached Google Routes API results.

## Hosting

The recommended deployment path is Supabase Postgres for data and Vercel for the Next.js app.

Hosted environment variables:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=your_server_only_secret_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_browser_google_maps_key
GOOGLE_MAPS_ROUTES_API_KEY=your_server_google_routes_key
```

## Importing A Google Maps Saved List

Run:

```bash
npm run import:google-list
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
