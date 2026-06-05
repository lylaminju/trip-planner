# Current Location Marker Design

Date: 2026-06-04

## Context

The map currently renders scheduled itinerary markers, unscheduled place markers,
and route polylines. There is no representation of the user's live browser
location.

The current-location marker should help during an active trip without adding
noise to future planning or past-trip review.

## Approved Behavior

Only ongoing trips can show the user's current location.

An ongoing trip is one whose trip date range includes the trip-local current
date, using the trip's configured timezone. Trips with missing dates, future
date ranges, or past date ranges do not show the location control or marker.

When the trip is ongoing:

- Show a top planner-panel button labeled `Show my location`.
- Clicking it requests browser geolocation permission and starts watching the
  user's position.
- When location is active, change the button label to `Hide my location`.
- Clicking `Hide my location` removes the marker and stops watching location.
- If the browser denies permission, lacks geolocation support, or returns an
  error, show a compact floating toast near the top of the planner panel.
- If the trip stops being ongoing while location is active, remove the marker
  and stop watching location.

When the trip is not ongoing:

- Do not show the location button.
- Do not request geolocation.
- Do not render the location marker.

## Marker Shape

Use a compact blue pulse-dot marker:

- Solid blue center dot.
- White border around the center dot.
- Subtle translucent blue ring or halo.
- Shape must be visually distinct from existing place markers.
- Size should stay modest on both desktop and mobile so it does not compete with
  numbered itinerary markers.

Do not use a navigation arrow because the app does not track heading direction.

## Map Behavior

The current-location marker is an overlay only.

- Do not include it in initial map bounds.
- Do not include it in selected-date bounds.
- Do not include it in route geometry or route calculations.
- Do not automatically pan or zoom to the user's location.
- Keep existing place, date, and segment selection behavior unchanged.

## Architecture

Add a reusable trip timing helper that can answer whether a trip is ongoing.
Keep it consistent with the existing dashboard grouping logic.

Own current-location toggle state in `TripPlannerApp` because it coordinates the
planner-panel button, geolocation errors, and map rendering.

Pass location state, toggle callbacks, and toast feedback into `PlannerPanel`.
Pass the active position and ongoing/toggle state into `MapPanel`.

Render geolocation failures as a floating planner-panel toast instead of inline
text. The toast must not reserve layout space or move existing panel content.
Clear it automatically after a short delay, and also clear it when the user
retries, hides location, or the trip stops being ongoing.

Keep browser geolocation handling in a focused hook or small helper so
`TripPlannerApp` does not directly own low-level `watchPosition` cleanup.

Render the blue pulse marker through the existing Google Maps overlay layer, but
with a separate DOM creator and marker key so it cannot be confused with place
markers.

## Testing

Add unit coverage for:

- Ongoing-trip detection using trip timezone.
- Missing-date, future, and past trips returning not ongoing.
- Geolocation watch cleanup through a small helper that can be tested with a
  mocked geolocation object.
- Current-location marker DOM class/content through an extracted marker DOM
  helper.

Run the repository's standard verification commands:

- `npm test`
- `npx tsc --noEmit`

Manual browser verification should cover:

- Button appears only for ongoing trips.
- First click requests location permission.
- Marker appears as a compact blue pulse dot.
- Hide button removes the marker.
- A compact floating toast appears without layout shift when permission is
  denied or geolocation is unavailable.
- Existing map focus and route behavior are unchanged.
