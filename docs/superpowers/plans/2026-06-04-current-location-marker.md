# Current Location Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an ongoing-trip-only “Show my location” toggle that displays a compact blue pulse-dot marker on the map without changing map bounds or causing planner-panel layout shift.

**Architecture:** Reuse the existing trip timezone classification logic for the ongoing-trip gate, add a small geolocation watch helper for testable browser cleanup, own location state in `TripPlannerApp`, render the button/toast in `PlannerPanel`, and render the marker through the existing Google Maps overlay layer with a separate marker record.

**Tech Stack:** React 19, TypeScript, Google Maps JavaScript API, Browser Geolocation API, Vitest, native CSS

---

## File Structure

- Modify: `src/lib/trip-classification.ts`
  - Export `isTripOngoing` using the same timezone-aware local date logic as `groupTripsByTiming`.
- Modify: `tests/trip-classification.test.ts`
  - Cover ongoing, missing-date, future, past, and timezone-sensitive trips.
- Create: `src/lib/current-location.ts`
  - Types and a testable `startCurrentLocationWatch` helper.
- Create: `tests/current-location.test.ts`
  - Cover successful coordinate mapping, cleanup, and error forwarding with a mocked geolocation object.
- Modify: `src/components/map-panel/map-marker-dom.ts`
  - Add `currentLocationMarkerContent`.
- Modify: `tests/map-marker-dom.test.ts`
  - Cover the current-location marker class/structure with a minimal mocked document.
- Modify: `src/components/map-panel/map-overlays.ts`
  - Add a current-location marker record and renderer that does not affect bounds.
- Modify: `src/components/MapPanel.tsx`
  - Accept current location position and pass it to overlays.
- Modify: `src/components/TripPlannerApp.tsx`
  - Own the ongoing gate, location toggle state, geolocation watch lifecycle, active position, and toast feedback.
- Modify: `src/components/PlannerPanel.tsx`
  - Render the ongoing-only location button and floating toast.
- Modify: `src/styles/components/map.css`
  - Style a compact blue pulse-dot marker.
- Modify: `src/styles/components/left-panel.css`
  - Style the top-panel location button and no-layout-shift floating toast.

### Task 1: Ongoing Trip Helper

- [ ] Add failing tests in `tests/trip-classification.test.ts` for `isTripOngoing`.
- [ ] Run `npm test -- tests/trip-classification.test.ts`; expect import/function failure.
- [ ] Export `isTripOngoing(trip: Pick<TripSummary, "start_date" | "end_date" | "timezone"> | null | undefined, now = new Date()): boolean` from `src/lib/trip-classification.ts`.
- [ ] Reuse `DEFAULT_TRIP_TIMEZONE` and `localIsoDate`; return false for missing trip or missing dates.
- [ ] Run `npm test -- tests/trip-classification.test.ts`; expect pass.

### Task 2: Geolocation Watch Helper

- [ ] Add failing tests in `tests/current-location.test.ts` for position mapping, cleanup, and error forwarding.
- [ ] Create `src/lib/current-location.ts` with:
  - `CurrentLocationPosition = { lat: number; lng: number; accuracy: number | null }`
  - `startCurrentLocationWatch(geolocation, onPosition, onError): () => void`
- [ ] Use `watchPosition` with high accuracy enabled, finite timeout, and a modest maximum age.
- [ ] Return a cleanup function that calls `clearWatch` exactly once for the created watch id.
- [ ] Run `npm test -- tests/current-location.test.ts`; expect pass.

### Task 3: Marker DOM And Overlay

- [ ] Add failing marker DOM tests for `currentLocationMarkerContent`.
- [ ] Implement `currentLocationMarkerContent` as a distinct DOM element with center dot and pulse ring classes.
- [ ] Extend `map-overlays.ts` with a separate `CurrentLocationMarkerRecord` and `renderCurrentLocationMarker` helper.
- [ ] Ensure current-location marker creation/removal never touches marker bounds or place marker selection.
- [ ] Run focused marker tests and `npx tsc --noEmit`; expect pass.

### Task 4: State, Button, Toast, And Map Wiring

- [ ] Compute `isCurrentLocationAvailable = isTripOngoing(snapshot.trip)` in `TripPlannerApp`.
- [ ] Add location state: enabled flag, active position, toast message, and watch cleanup ref.
- [ ] Add `toggleCurrentLocation` that starts/stops the watch and clears toast on retry/hide.
- [ ] Stop watching and clear marker/toast when the trip is not ongoing.
- [ ] Pass location props to `PlannerPanel` and `MapPanel`.
- [ ] In `PlannerPanel`, render `Show my location` / `Hide my location` only when ongoing.
- [ ] Render location errors as an absolutely positioned toast that does not reserve layout space.
- [ ] In `MapPanel`, render/remove the blue pulse marker from current position.
- [ ] Run `npm test`, `npx tsc --noEmit`, and `git diff --check`; expect pass.

### Task 5: Manual Verification

- [ ] With an ongoing trip, confirm the button appears and no button appears for non-ongoing trips.
- [ ] Confirm first click requests geolocation and shows the compact blue pulse dot.
- [ ] Confirm the marker does not alter initial bounds or selected-date bounds.
- [ ] Confirm `Hide my location` removes the marker and stops watching.
- [ ] Confirm denied/unavailable geolocation shows a floating toast with no layout shift.
- [ ] Confirm existing map place/date/segment focus behavior still works.

