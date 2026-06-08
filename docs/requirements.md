# TripGlance Project Requirements

This document outlines the exact technical requirements, data schema, and UI structure necessary to build the TripGlance web application.

## 1. Tech Stack Overview

- **Framework:** Next.js (App Router)
- **UI Library:** React 19
- **Language:** TypeScript
- **Database:** SQLite via `better-sqlite3`
- **Styling:** Native CSS (No Tailwind)
- **Mapping:** Google Maps JavaScript API (using `AdvancedMarkerElement` and `Polyline`)

## 2. Core Features

- **Place Management:** Users can add places via a form with details such as name, google map url, and visit date & time. At the left panel, user can drag-and-drop each place to change the date.
- **Itinerary Generation:** Places are automatically grouped by date (maybe `visit_datetime` substring) into "Itinerary Days". Unscheduled places fall into a default bucket.
- **Route Segments & Travel Modes:** Between any two consecutive places on a scheduled day, an automatic "segment" is created. Users can change the travel mode (`walk`, `transit`, `bike`, `car`) for each segment.
- **Interactive Map:** Displays Google Maps with markers representing places. Markers and routes (Polylines) are grouped and color-coded by day. Allows selection and interaction.
- **Google Maps Importer:** A Node.js script to extract saved lists from a shared Google Maps URL and insert them into the local SQLite database.

## 3. Database Schema (SQLite)

### Table: `places`

Stores all saved places.

- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `name` (TEXT NOT NULL)
- `address` (TEXT, nullable)
- `google_maps_url` (TEXT, nullable)
- `place_id` (TEXT, nullable)
- `google_place_token` (TEXT, nullable)
- `google_internal_ids` (TEXT, nullable)
- `source_list_url` (TEXT, nullable)
- `latitude` (REAL NOT NULL)
- `longitude` (REAL NOT NULL)
- `visit_date` (TEXT, nullable)
- `visit_time` (TEXT, nullable)
- `notes` (TEXT, nullable)
- `created_at` (TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)

### Table: `route_segments`

Stores travel logic between consecutive places on a specific day.

- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `from_place_id` (INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE)
- `to_place_id` (INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE)
- `mode` (TEXT NOT NULL DEFAULT 'walk' CHECK (mode IN ('walk', 'transit', 'bike', 'car')))
- _Constraint:_ `UNIQUE (from_place_id, to_place_id)`

**Note on Database State:** Whenever a place is added, removed, or its date changed, a function must reconcile `route_segments` for that day, deleting invalid segments and inserting new ones between consecutive places based on sorting (ordered by time).

## 4. UI Structure & Components

The interface is a two-pane layout: a **Left Panel** (Controls & Lists) and a **Right Panel** (Interactive Map).

### Left Panel

- **Add Place button and Add Place Form Modal:**
  - Inputs for Name (required), Date, Time, Google Maps URL (required), and Notes.
  - Submit button (shows saving state).
- **Itineraries List (Collapsible):**
  - Groups places by day.
  - Each day gets a unique color dot.
  - Displays the consecutive stops in order.
  - Between consecutive stops, it displays a dropdown `<select>` allowing users to pick the Travel Mode (Walk, Transit, Bike, Car) for that `route_segment`.
- **Places List (Collapsible):**
  - Displays a raw list of all saved places, showing Name, Address, and formatted Date/Time.
  - Clicking a row triggers the active state and pans/selects the map marker.

### Right Panel

- Loads Google Maps asynchronously. Gracefully falls back to a text list of coordinates if `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is missing.
- **Markers:** Place markers are colored based on their day group. Active selections highlight the marker.
- **Polylines:** Draws lines connecting the stops for a specific day using `google.maps.Polyline`. The stroke color matches the day's color. Active days increase the stroke width and opacity, dimming others.
- The map automatically calculates bounds and zooms to fit all rendered markers on load or update.

## 5. Important Behaviors

- **Sorting Logic:** Places within a day must strictly sort by: `Date` -> `Time` -> `name`.
- **Google Maps Data Extraction:** Refer to `docs/google-maps-saved-list-extraction.md` for information on the companion script that scrapes unauthenticated Google Maps List XSSI data and populates SQLite.
