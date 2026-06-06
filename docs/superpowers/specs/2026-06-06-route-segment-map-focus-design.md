# Route Segment Map Focus Design

## Goal

When a user clicks a route segment row in the planner panel, the map should focus the corresponding route by showing both endpoint places.

## Current Behavior

The app already tracks `activeSegmentId` when a user clicks a route segment row or route polyline. The selected segment is highlighted in the planner and on the map, but the map viewport does not move when selection originates from the planner.

## Proposed Behavior

Clicking a route segment row keeps the existing selection/highlight behavior and fits the map to the segment's two endpoint places. If both endpoint coordinates are the same, the map pans to that point instead of fitting an empty or degenerate bounds area.

On mobile half-sheet layouts, the route focus should use the same vertical offset behavior as existing place and date focus so the focused route remains visible above the sheet.

## Scope

- Add a viewport helper that resolves an active route segment to endpoint coordinates.
- Add a `MapPanel` focus effect for `activeSegmentId`.
- Do not change route creation, route geometry fetching, or route polyline rendering.
- Do not require route geometry to exist; endpoint coordinates are sufficient.

## Testing

- Unit-test the viewport helper for matching segments, missing selection, missing endpoint items, and same-coordinate endpoints.
- Run the focused viewport test, full test suite, TypeScript check, and production build.
