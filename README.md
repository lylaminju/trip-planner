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

## AI Itinerary Planning

Trip owners can generate a complete dated itinerary from a short guided brief, on
supported destinations with dates set. Generated visits land in the normal
planner, where every stop stays editable.

- **Plan validation:** A plan is rejected for out-of-range dates, visit counts outside the chosen pace, missing must-sees, or times that violate the daily start time and arrival/departure windows.
- **Automatic repair pass:** If the first plan fails validation, the errors are fed back for one repair attempt. If that also fails, the generation is recorded as failed and nothing is written to the trip.
- **Non-destructive regeneration:** Generating again replaces only visits from previous AI batches. Manually added places are kept.
- **Route timing and modes:** Generated visits are saved with times and route segments, using the preferred travel modes and real route durations.

### Wizard Steps

The brief runs six steps.

- **Step 1 — Pace:** Relaxed (1-2), Balanced (2-3), or Packed (3-5) visits per day, which set the min/max visit range the plan is validated against.
- **Step 2 — Interests (optional):** Landmarks, museums & galleries, nature, local vibe, food & markets, shopping, and kid-friendly tags steer candidate selection.
- **Step 3 — Getting around:** Pick one or more travel modes (walking, transit, bicycling, driving) and a daily start time, and optionally paste a Google Maps link for the lodging so days start and end near it.
- **Step 4 — Start & end (optional):** Pick arrival and departure hubs from the destination's known airports, stations, and terminals, or paste a Google Maps link. Setting times plans the first and last day around them.
- **Step 5 — Must-sees (optional):** Lock in specific candidates, shown with thumbnails and descriptions, and the plan is built around them.
- **Step 6 — Review:** Check the assembled brief, jump back to any step to edit it, then generate.

## Tech Stack

- Next.js App Router
- React 19
- TypeScript
- Supabase Postgres and Supabase Auth
- Native CSS
- Google Maps JavaScript API
- Google Routes API, optional for real route polylines
- OpenAI Responses API for AI itinerary generation
- Vitest

## Importing A Google Maps Saved List

Run:

```bash
npm run import:google-list
TRIP_PLANNER_DEFAULT_TRIP_ID=1 npm run push:supabase
```

The importer reads the configured shared Google Maps saved-list endpoint in `scripts/import-google-list.mjs`, imports places into the legacy SQLite database, and keeps imported places unscheduled. Run `npm run push:supabase` afterward to move those imported rows into Supabase. See `docs/google-maps-saved-list-extraction.md` for details and caveats.

## Notes

- The saved-list importer uses an undocumented Google Maps endpoint and may need updates if Google changes the response format.
