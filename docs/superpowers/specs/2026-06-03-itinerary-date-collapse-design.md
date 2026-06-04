# Itinerary Date Collapse Design

Date: 2026-06-03

## Context

The Itineraries section groups scheduled places by date. A date title currently
acts as a map-focus toggle: clicking it selects the date, highlights that date's
map content, and focuses the map on scheduled places for the date.

Users need a separate control that collapses a date's itinerary rows without
changing the date-selection behavior.

## Approved Behavior

Each itinerary date gets a small collapse/expand toggle next to its date title.

When a date is collapsed:

- Keep the date header visible.
- Keep the existing add-place button visible for editable trips.
- Hide all itinerary item rows for that date.
- Hide insertion drop zones, untimed dividers, route segment rows, and end drop
  zones for that date.
- Keep the day block visible so dropping a place onto the collapsed day still
  schedules it to that date.

When a date is expanded again, all existing rows and controls for that date
return with their previous behavior.

The date title remains responsible for selecting/focusing the date on the map.
The new collapse toggle only collapses or expands that date and does not select
or focus the map.

Collapsed-date state is local UI state only. It is not persisted to the server
or browser storage.

## Architecture

Store collapsed dates in `TripPlannerApp` as a set of date strings. Pass the
collapsed-date state and a date toggle callback through `PlannerPanel` into
`ItinerarySection`.

`ItinerarySection` renders the new header control and conditionally skips the
date's item-row body when the date is collapsed. Existing day-level drag/drop
handlers stay on the `day-block`, so collapsed dates remain valid drop targets.

Add CSS next to the existing date-heading styles. Keep the control compact and
button-like so it works in both desktop and mobile layouts without changing the
date title's clickable area.

## Testing

Add a small pure helper for toggling collapsed date sets if that keeps behavior
easy to test without introducing a React test harness. Cover:

- Adding a date to the collapsed set.
- Removing a date from the collapsed set.
- Preserving other collapsed dates.

Run the repository's standard verification commands:

- `npm test`
- `npx tsc --noEmit`

