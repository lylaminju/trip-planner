# Itinerary Date Map Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition the map to show every place scheduled for a selected itinerary date on desktop and mobile while leaving the viewport unchanged when the date is deselected.

**Architecture:** Add a pure date-to-coordinates selector beside the existing place-selection viewport helper. Use that helper from a dedicated `MapPanel` effect so Google Maps bounds and mobile-sheet offset behavior remain inside the browser integration component.

**Tech Stack:** React 19, TypeScript, Google Maps JavaScript API, Vitest

---

## File Structure

- Modify: `src/lib/map-viewport.ts`
  - Add a pure helper that returns every scheduled place position for an active date.
- Modify: `tests/map-viewport.test.ts`
  - Lock date filtering, untimed-item inclusion, single-place behavior, and empty-result behavior.
- Modify: `src/components/MapPanel.tsx`
  - Apply selected-date viewport movement through `panTo` or `fitBounds`, retaining the existing mobile half-sheet offset.

### Task 1: Add The Selected-Date Viewport Helper

**Files:**
- Modify: `tests/map-viewport.test.ts`
- Modify: `src/lib/map-viewport.ts`

- [ ] **Step 1: Write the failing unit tests**

Update the import in `tests/map-viewport.test.ts`:

```ts
import {
  getSelectedDatePositions,
  getSelectedPlacePosition,
} from "@/lib/map-viewport";
```

Add this suite after the existing `getSelectedPlacePosition` suite:

```ts
describe("getSelectedDatePositions", () => {
  it("returns coordinates only for the selected date", () => {
    expect(
      getSelectedDatePositions(
        [
          item({
            id: 1,
            visit_date: "2026-06-01",
            place: place({ id: 1, latitude: 40.7, longitude: -73.9 }),
          }),
          item({
            id: 2,
            visit_date: "2026-06-02",
            place: place({ id: 2, latitude: 40.76, longitude: -73.98 }),
          }),
        ],
        "2026-06-01",
      ),
    ).toEqual([{ lat: 40.7, lng: -73.9 }]);
  });

  it("includes selected-date places without visit times", () => {
    expect(
      getSelectedDatePositions(
        [
          item({
            visit_date: "2026-06-01",
            visit_time: null,
            place: place({ latitude: 41, longitude: -75 }),
          }),
        ],
        "2026-06-01",
      ),
    ).toEqual([{ lat: 41, lng: -75 }]);
  });

  it("returns one coordinate for a single-place date", () => {
    expect(
      getSelectedDatePositions(
        [
          item({
            visit_date: "2026-06-01",
            place: place({ latitude: 42, longitude: -76 }),
          }),
        ],
        "2026-06-01",
      ),
    ).toEqual([{ lat: 42, lng: -76 }]);
  });

  it("returns no coordinates for an inactive or missing date", () => {
    const items = [item({ visit_date: "2026-06-01" })];

    expect(getSelectedDatePositions(items, null)).toEqual([]);
    expect(getSelectedDatePositions(items, "2026-06-03")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm test -- tests/map-viewport.test.ts
```

Expected: FAIL because `getSelectedDatePositions` is not exported from `src/lib/map-viewport.ts`.

- [ ] **Step 3: Add the minimal helper implementation**

Append this function to `src/lib/map-viewport.ts`:

```ts
export function getSelectedDatePositions(
  items: ItineraryItem[],
  activeDate: string | null,
): MapPosition[] {
  if (activeDate === null) {
    return [];
  }

  return items
    .filter((item) => item.visit_date === activeDate)
    .map((item) => ({
      lat: item.place.latitude,
      lng: item.place.longitude,
    }));
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
npm test -- tests/map-viewport.test.ts
```

Expected: PASS for the existing place-selection tests and the new date-selection tests.

- [ ] **Step 5: Commit the viewport helper**

```bash
git add src/lib/map-viewport.ts tests/map-viewport.test.ts
git commit -m "feat: select itinerary date map positions" -m "Confidence: high
Scope-risk: narrow"
```

### Task 2: Focus The Map When A Date Is Selected

**Files:**
- Modify: `src/components/MapPanel.tsx`

- [ ] **Step 1: Import the selected-date helper**

Replace the viewport helper import in `src/components/MapPanel.tsx`:

```ts
import {
  getSelectedDatePositions,
  getSelectedPlacePosition,
} from "@/lib/map-viewport";
```

- [ ] **Step 2: Add the date-selection viewport effect**

Add this effect immediately after the existing selected-place viewport effect in
`src/components/MapPanel.tsx`:

```ts
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (
      !apiKey ||
      loadFailed ||
      !isMapReady ||
      !map ||
      !window.google?.maps ||
      props.hidden
    ) {
      return;
    }

    const positions = getSelectedDatePositions(
      itineraryItems,
      props.activeDate,
    );
    if (positions.length === 0) {
      return;
    }

    if (positions.length === 1) {
      map.panTo(positions[0]);
      if (shouldOffsetFocusForHalfSheet(props.mobileSheetState)) {
        map.panBy(0, Math.round(window.innerHeight * 0.32));
      }
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    for (const position of positions) {
      bounds.extend(position);
    }
    map.fitBounds(bounds, 48);

    if (shouldOffsetFocusForHalfSheet(props.mobileSheetState)) {
      window.google.maps.event?.addListenerOnce?.(map, "idle", () => {
        map.panBy(0, Math.round(window.innerHeight * 0.32));
      });
    }
  }, [
    apiKey,
    isMapReady,
    itineraryItemsSignature,
    loadFailed,
    props.activeDate,
    props.hidden,
    props.mobileSheetState,
  ]);
```

This effect intentionally returns without moving the map when `activeDate` is
`null`, which preserves the current viewport when the active date heading is
clicked a second time.

- [ ] **Step 3: Run TypeScript validation**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Run the focused viewport tests**

Run:

```bash
npm test -- tests/map-viewport.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the map focus behavior**

```bash
git add src/components/MapPanel.tsx
git commit -m "feat: focus map on selected itinerary date" -m "Confidence: high
Scope-risk: narrow"
```

### Task 3: Verify The Complete Change

**Files:**
- Verify: `src/lib/map-viewport.ts`
- Verify: `src/components/MapPanel.tsx`
- Verify: `tests/map-viewport.test.ts`

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS for the complete Vitest suite.

- [ ] **Step 2: Run TypeScript validation**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Check patch formatting**

Run:

```bash
git diff --check HEAD~2..HEAD
```

Expected: no output.

- [ ] **Step 4: Review the final diff**

Run:

```bash
git diff --stat HEAD~2..HEAD
git diff HEAD~2..HEAD -- src/lib/map-viewport.ts src/components/MapPanel.tsx tests/map-viewport.test.ts
```

Expected: the diff contains only the viewport helper, its tests, and the
selected-date `MapPanel` effect.

- [ ] **Step 5: Perform manual browser verification when local map credentials are configured**

Run:

```bash
npm run dev
```

Verify:

1. On desktop, selecting a date heading fits all scheduled places for that date.
2. A date with an untimed place includes that marker in the fitted area.
3. A single-place date centers that place without changing the current zoom.
4. Selecting the active date heading again clears highlighting without changing
   the viewport.
5. In a mobile-width browser with the half-height sheet, selected-date content
   remains visible above the sheet.
6. Selecting an individual place still centers that place.

Expected: all six checks pass. If local map credentials are unavailable, record
manual browser verification as not run and rely on the automated checks.

