# Itinerary Date Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-date collapse toggle in the Itineraries section that hides a date's itinerary rows while preserving date-title map focus and day-level drop behavior.

**Architecture:** Store collapsed dates as UI-only state in `TripPlannerApp`, pass the set and toggle callback through `PlannerPanel` to `ItinerarySection`, and keep row hiding local to the day block render path. Add a pure set-toggle helper with unit tests so collapse state behavior is covered without introducing a React test harness.

**Tech Stack:** React 19, TypeScript, native CSS, Vitest

---

## File Structure

- Create: `src/lib/date-collapse.ts`
  - Pure helper for toggling a date in a readonly set.
- Create: `tests/date-collapse.test.ts`
  - Unit tests for adding, removing, and preserving collapsed dates.
- Modify: `src/components/TripPlannerApp.tsx`
  - Own the `collapsedDates` state and pass it to `PlannerPanel`.
- Modify: `src/components/PlannerPanel.tsx`
  - Add collapsed-date props and forward them to `ItinerarySection`.
- Modify: `src/components/planner-panel/ItinerarySection.tsx`
  - Render the per-date collapse toggle and skip date body rows when collapsed.
- Modify: `src/styles/components/left-panel.css`
  - Style the compact date collapse toggle next to existing heading controls.

### Task 1: Add The Collapsed-Date State Helper

**Files:**
- Create: `src/lib/date-collapse.ts`
- Create: `tests/date-collapse.test.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `tests/date-collapse.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { toggleCollapsedDate } from "@/lib/date-collapse";

describe("toggleCollapsedDate", () => {
  it("adds an expanded date to the collapsed set", () => {
    expect(
      Array.from(toggleCollapsedDate(new Set<string>(), "2026-06-03")),
    ).toEqual(["2026-06-03"]);
  });

  it("removes a collapsed date from the collapsed set", () => {
    expect(
      Array.from(
        toggleCollapsedDate(new Set(["2026-06-03"]), "2026-06-03"),
      ),
    ).toEqual([]);
  });

  it("preserves other collapsed dates", () => {
    expect(
      Array.from(
        toggleCollapsedDate(
          new Set(["2026-06-02", "2026-06-03"]),
          "2026-06-03",
        ),
      ),
    ).toEqual(["2026-06-02"]);
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm test -- tests/date-collapse.test.ts
```

Expected: FAIL because `@/lib/date-collapse` does not exist.

- [ ] **Step 3: Add the minimal helper implementation**

Create `src/lib/date-collapse.ts`:

```ts
export function toggleCollapsedDate(
  current: ReadonlySet<string>,
  date: string,
): Set<string> {
  const next = new Set(current);

  if (next.has(date)) {
    next.delete(date);
  } else {
    next.add(date);
  }

  return next;
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
npm test -- tests/date-collapse.test.ts
```

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the helper**

```bash
git add src/lib/date-collapse.ts tests/date-collapse.test.ts
git commit -m "feat: add collapsed date state helper" -m "Confidence: high
Scope-risk: narrow"
```

### Task 2: Wire Collapsed Date State Through The Planner

**Files:**
- Modify: `src/components/TripPlannerApp.tsx`
- Modify: `src/components/PlannerPanel.tsx`
- Modify: `src/components/planner-panel/ItinerarySection.tsx`

- [ ] **Step 1: Import the helper in `TripPlannerApp`**

Add this import near the other `@/lib/*` imports in `src/components/TripPlannerApp.tsx`:

```ts
import { toggleCollapsedDate } from "@/lib/date-collapse";
```

- [ ] **Step 2: Add collapsed-date state in `TripPlannerApp`**

Add this state near the other UI selection state in `TripPlannerApp`:

```ts
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(
    () => new Set(),
  );
```

Add this callback before `return (`:

```ts
  function toggleDateCollapsed(date: string) {
    setCollapsedDates((current) => toggleCollapsedDate(current, date));
  }
```

- [ ] **Step 3: Pass collapsed-date props into `PlannerPanel`**

Add these props to the `PlannerPanel` element in `src/components/TripPlannerApp.tsx`:

```tsx
        collapsedDates={collapsedDates}
        onToggleDateCollapsed={toggleDateCollapsed}
```

- [ ] **Step 4: Add the props to `PlannerPanel`**

Add these fields to the `Props` type in `src/components/PlannerPanel.tsx`:

```ts
  collapsedDates: ReadonlySet<string>;
  onToggleDateCollapsed: (date: string) => void;
```

Forward them to `ItinerarySection`:

```tsx
        collapsedDates={props.collapsedDates}
        onToggleDateCollapsed={props.onToggleDateCollapsed}
```

- [ ] **Step 5: Add the props to `ItinerarySection`**

Add these fields to the `Props` type in `src/components/planner-panel/ItinerarySection.tsx`:

```ts
  collapsedDates: ReadonlySet<string>;
  onToggleDateCollapsed: (date: string) => void;
```

- [ ] **Step 6: Run TypeScript validation**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 7: Commit the state wiring**

```bash
git add src/components/TripPlannerApp.tsx src/components/PlannerPanel.tsx src/components/planner-panel/ItinerarySection.tsx
git commit -m "feat: wire itinerary date collapse state" -m "Confidence: high
Scope-risk: narrow"
```

### Task 3: Render The Per-Date Collapse Toggle And Hide Rows

**Files:**
- Modify: `src/components/planner-panel/ItinerarySection.tsx`
- Modify: `src/styles/components/left-panel.css`

- [ ] **Step 1: Compute collapse state per day**

Inside the `props.itinerary.days.map((day, dayIndex) => (` callback in
`src/components/planner-panel/ItinerarySection.tsx`, change the concise return
to a block body so each day can compute its collapsed state:

```tsx
          {props.itinerary.days.map((day, dayIndex) => {
            const collapsed = props.collapsedDates.has(day.date);

            return (
              <div
```

Close the block body after the day block:

```tsx
              </div>
            );
          })}
```

- [ ] **Step 2: Add the collapse toggle next to the date title**

Inside the existing `<h3 className="day-heading">`, place this button after the
date title button and before the editable add-place button:

```tsx
                <button
                  type="button"
                  className="day-collapse-button"
                  aria-expanded={!collapsed}
                  aria-label={`${collapsed ? "Expand" : "Collapse"} ${formatItineraryDateHeading(day.date)} itinerary`}
                  title={`${collapsed ? "Expand" : "Collapse"} itinerary`}
                  onClick={() => props.onToggleDateCollapsed(day.date)}
                >
                  <span aria-hidden="true">{collapsed ? ">" : "v"}</span>
                </button>
```

The button must not call `props.onSelectDate`; clicking it only changes
collapse state.

- [ ] **Step 3: Hide the date body when collapsed**

Change the existing line that starts the item-row render loop from:

```tsx
              {day.items.map((item, index) => {
```

to:

```tsx
              {!collapsed &&
                day.items.map((item, index) => {
```

Then keep the existing loop body and closing `})}` in place, only adjusting
indentation if needed. This guard hides item rows, insertion drop zones, untimed
dividers, segment rows, and end drop zones while preserving the day-level drop
handlers on `.day-block`.

- [ ] **Step 4: Add CSS for the collapse toggle**

Add this near the existing `.day-add-place-button` styles in
`src/styles/components/left-panel.css`:

```css
.day-collapse-button {
  align-items: center;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  flex: 0 0 28px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  height: 28px;
  justify-content: center;
  line-height: 1;
  padding: 0;
  width: 28px;
}

.day-collapse-button:hover {
  background: #f1f5f9;
  border-color: #b9c5d1;
  color: var(--ink);
}
```

- [ ] **Step 5: Run TypeScript validation**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Run the focused helper test**

Run:

```bash
npm test -- tests/date-collapse.test.ts
```

Expected: PASS with 3 tests.

- [ ] **Step 7: Commit the UI behavior**

```bash
git add src/components/planner-panel/ItinerarySection.tsx src/styles/components/left-panel.css
git commit -m "feat: collapse itinerary dates" -m "Confidence: high
Scope-risk: narrow"
```

### Task 4: Verify The Complete Change

**Files:**
- Verify: `src/lib/date-collapse.ts`
- Verify: `tests/date-collapse.test.ts`
- Verify: `src/components/TripPlannerApp.tsx`
- Verify: `src/components/PlannerPanel.tsx`
- Verify: `src/components/planner-panel/ItinerarySection.tsx`
- Verify: `src/styles/components/left-panel.css`

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
git diff --check HEAD~3..HEAD
```

Expected: no output.

- [ ] **Step 4: Review the final diff**

Run:

```bash
git diff --stat HEAD~3..HEAD
git diff HEAD~3..HEAD -- src/lib/date-collapse.ts tests/date-collapse.test.ts src/components/TripPlannerApp.tsx src/components/PlannerPanel.tsx src/components/planner-panel/ItinerarySection.tsx src/styles/components/left-panel.css
```

Expected: the diff contains only the collapse helper, tests, state wiring,
per-date toggle rendering, collapsed body guard, and CSS.

- [ ] **Step 5: Perform manual browser verification**

Run:

```bash
npm run dev
```

Verify:

1. Each itinerary date header has a collapse/expand toggle next to the date
   title.
2. Clicking the date title still focuses/highlights that date on the map.
3. Clicking the collapse toggle hides that date's itinerary rows and route
   segment rows without focusing the map.
4. The add-place button remains visible for editable trips while collapsed.
5. Dropping a place onto the collapsed day block still schedules it to that
   date.
6. Expanding the date restores the hidden rows.
7. The control remains usable in a mobile-width browser.

Expected: all seven checks pass. If manual browser verification is interrupted
or local runtime prerequisites are unavailable, record which checks were not run
and rely on automated checks for the code paths they cover.
