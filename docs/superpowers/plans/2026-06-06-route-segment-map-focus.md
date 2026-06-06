# Route Segment Map Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Focus the map on a route segment's two endpoint places when the user selects that segment from the planner panel.

**Architecture:** Add a pure viewport helper in `src/lib/map-viewport.ts` that resolves `activeSegmentId` to endpoint coordinates. `MapPanel` will call that helper in a new effect and fit/pan the existing Google map without changing route rendering or route geometry fetching.

**Tech Stack:** React, Next.js client components, Google Maps JavaScript API, Vitest, TypeScript.

---

### Task 1: Segment Endpoint Viewport Helper

**Files:**

- Modify: `src/lib/map-viewport.ts`
- Test: `tests/map-viewport.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that expect `getSelectedSegmentPositions(items, routeSegments, activeSegmentId)` to:

- return the from/to place coordinates for a matching segment
- return `[]` when `activeSegmentId` is `null`
- return `[]` when either endpoint item is missing

- [ ] **Step 2: Run focused test to verify failure**

Run: `npm test -- tests/map-viewport.test.ts`

Expected: failure because `getSelectedSegmentPositions` is not exported.

- [ ] **Step 3: Implement helper**

Add `getSelectedSegmentPositions` to `src/lib/map-viewport.ts`. It should look up the active segment by id, find both endpoint itinerary items, and return exactly two `{ lat, lng }` positions.

- [ ] **Step 4: Run focused test to verify pass**

Run: `npm test -- tests/map-viewport.test.ts`

Expected: all map viewport tests pass.

### Task 2: MapPanel Segment Focus Effect

**Files:**

- Modify: `src/components/MapPanel.tsx`

- [ ] **Step 1: Add segment focus effect**

Import `getSelectedSegmentPositions`. Add an effect keyed by `activeSegmentId`, itinerary item signature, route segment signature, hidden state, map readiness, and mobile sheet state.

Behavior:

- if no active segment or no endpoint positions, do nothing
- if endpoints share coordinates, `panTo` the point
- otherwise build `LatLngBounds`, extend both points, and `fitBounds(bounds, 64)`
- on mobile half sheet, offset after focus using the existing `shouldOffsetFocusForHalfSheet` behavior

- [ ] **Step 2: Run verification**

Run:

- `npm test`
- `npx tsc --noEmit`
- `npm run build`

Expected: all pass.
