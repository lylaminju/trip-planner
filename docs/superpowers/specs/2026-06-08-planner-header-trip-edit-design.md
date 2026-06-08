# Planner Header Trip Edit Design

## Goal

Reduce planner header clutter from issue 14 and expose owner-only trip metadata
editing from the planner screen.

## Requirements

- Split the planner panel header into two rows.
- Keep the first row reserved for the trip name and expand/collapse control.
- Put secondary planner actions in the second row and end with `Log out`.
- Move `Show my location` to a circular bottom-right map control because it
  changes map state rather than planner metadata.
- Add an `Edit trip` action that edits trip name, start date, end date, and
  timezone.
- Show `Edit trip` only to trip owners. Editors and viewers can continue using
  planner permissions exactly as before.
- Save metadata through the existing trip update API and update the current
  planner state immediately after a successful save.

## Design

The planner header remains compact product UI. `PlannerPanel` owns only header
rendering and action callbacks. `TripPlannerApp` owns the edit-trip modal state,
form state, timezone option derivation, save request, and refreshed `trip`
state because the trip period drives itinerary date options.

The current-location UI follows common map-control placement: a compact circular
button at the bottom-right of the map, with a pressed state while location is
active and map-anchored permission feedback.

The edit UI reuses the existing modal and form-control vocabulary. It should
look like the existing place and itinerary modals rather than introduce a new
settings surface. The modal title is `Edit trip`, the primary button is
`Save changes`, and cancel closes without changing state.

## Error Handling

Save errors should surface through the existing planner error region. The modal
stays open when saving fails so the user can correct fields or retry.

## Testing

- Add a server-rendered component test that checks header row structure and
  owner-only `Edit trip` visibility.
- Add a save-path test or component contract coverage that confirms the planner
  can render the metadata edit affordance without regressing the existing title
  render.
- Run `npm test`, `npx tsc --noEmit`, and `npm run build` because the change
  affects client/server component boundaries and planner routing UI.
