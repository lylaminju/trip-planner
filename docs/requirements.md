# TripGlance Project Requirements

This document outlines the technical requirements and UI structure for the TripGlance web application. The database schema lives in [supabase/schema.sql](../supabase/schema.sql), with incremental changes in `supabase/migrations/`.

## 1. Tech Stack Overview

- **Framework:** Next.js (App Router)
- **UI Library:** React 19
- **Language:** TypeScript
- **Database:** Supabase Postgres
- **Styling:** Native CSS (No Tailwind)
- **Mapping:** Google Maps JavaScript API (using `AdvancedMarkerElement` and `Polyline`)

## 2. Core Features

- **Place Management:** Users can add places via a form with details such as name, google map url, and visit date & time. At the left panel, user can drag-and-drop each place to change the date.
- **Itinerary Generation:** Scheduling lives on `itinerary_items`, which are grouped by `visit_date` into "Itinerary Days". Items without a `visit_date` fall into a default unscheduled bucket.
- **Route Segments & Travel Modes:** Between any two consecutive itinerary items on a scheduled day, an automatic "segment" is created. Users can change the travel mode (`walking`, `transit`, `bicycling`, `driving`) for each segment.
- **Interactive Map:** Displays Google Maps with markers representing places. Markers and routes (Polylines) are grouped and color-coded by day. Allows selection and interaction.

## 3. UI Structure & Components

The interface is a two-pane layout: a **Left Panel** (Controls & Lists) and a **Right Panel** (Interactive Map).

### Left Panel

- **Add Place button and Add Place Form Modal:**
  - Inputs for Name (required), Date, Time, Google Maps URL (required), and Notes.
  - Submit button (shows saving state).
- **Itineraries List (Collapsible):**
  - Groups places by day.
  - Each day gets a unique color dot.
  - Displays the consecutive stops in order.
  - Between consecutive stops, it displays a travel-mode menu (Walking, Transit, Bicycling, Driving) for that `route_segment`.
- **Places List (Collapsible):**
  - Displays a raw list of all saved places, showing Name, Address, and formatted Date/Time.
  - Clicking a row triggers the active state and pans/selects the map marker.

### Right Panel

- Loads Google Maps asynchronously. Gracefully falls back to a text list of coordinates if `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is missing.
- **Markers:** Place markers are colored based on their day group. Active selections highlight the marker.
- **Polylines:** Draws lines connecting the stops for a specific day using `google.maps.Polyline`. The stroke color matches the day's color. Active days increase the stroke width and opacity, dimming others.
- The map automatically calculates bounds and zooms to fit all rendered markers on load or update.

## 4. Important Behaviors

- **Sorting Logic:** Within an Itinerary Day, items sort by: timed items before untimed, then `visit_time`, then `name`. See `compareScheduledItems` in `src/lib/itinerary.ts`.
- **Google Maps Data Extraction:** The saved-list importer has been removed. See [docs/google-maps-saved-list-extraction.md](google-maps-saved-list-extraction.md) for the historical research on the unauthenticated Google Maps List XSSI endpoint.
