# Itinerary Date Map Focus Design

Date: 2026-05-31

## Context

The itinerary date heading already acts as a toggle. Selecting a date highlights
that day's markers and route segments, while selecting the same date again clears
the highlight. The map currently changes its viewport for place selection only,
so date selection can highlight content outside the visible map area.

## Approved Behavior

When the user selects an itinerary date heading on desktop or mobile:

- Fit the map viewport to every place scheduled for that date.
- Include scheduled places without a visit time.
- Include the route geometry where available through the existing rendered map
  overlays.
- If the date contains one place, center the map on that place without forcing a
  new zoom level.
- If the date contains no scheduled places, leave the viewport unchanged.
- Preserve the existing mobile half-sheet vertical offset so focused content
  remains visible above the sheet.

When the user selects the already-active date heading again:

- Clear the date highlight.
- Leave the current map viewport unchanged.

Existing place-click focus behavior remains unchanged.

## Architecture

Add a focused helper in `src/lib/map-viewport.ts` that returns the coordinates
for itinerary items matching a selected date. Keep filtering and edge-case logic
independent of Google Maps browser objects so it can be unit tested.

Extend `src/components/MapPanel.tsx` with a date-selection viewport effect:

1. Read the selected date's coordinates from the viewport helper.
2. Leave the viewport unchanged when no date is selected or no matching places
   exist.
3. Call `panTo` for a single matching place.
4. Build a Google Maps `LatLngBounds`, extend it with each matching coordinate,
   and call `fitBounds` for multiple places.
5. Apply the existing mobile half-sheet vertical offset after the map has
   finished fitting bounds.

Route polylines already connect scheduled place coordinates and remain rendered
during selection. Fitting every scheduled place for the day satisfies the
approved viewport behavior without coupling the helper to Google Maps route
objects or geometry decoding.

## Testing

Extend `tests/map-viewport.test.ts` to verify that the new helper:

- Returns coordinates only for the requested date.
- Includes matching itinerary items without visit times.
- Returns a single coordinate for a single-place date.
- Returns an empty list for a missing or inactive date.

Run the repository's standard verification commands:

- `npm test`
- `npx tsc --noEmit`

