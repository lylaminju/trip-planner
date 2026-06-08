# Planner Header Trip Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the planner header into issue-14 rows, add owner-only trip metadata editing from the planner, and move current location to a map control.

**Architecture:** Keep header layout in `PlannerPanel`, keep trip metadata save state in `TripPlannerApp`, and reuse the existing `PATCH /api/trips/:tripId` client helper. Add a small modal component for trip metadata fields so `TripPlannerApp` does not grow a large inline form.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, existing CSS modules under `src/styles`.

---

## File Structure

- Modify `tests/trip-planner-app.test.ts`: add regression tests for header rows, owner-only edit affordance, and map-scoped current location.
- Modify `src/components/PlannerPanel.tsx`: split header markup and accept an owner-only trip edit callback.
- Modify `src/components/MapPanel.tsx`: render the circular map-scoped current-location control and toast.
- Modify `src/components/TripPlannerApp.tsx`: own edit-trip form state, save flow, timezone options, modal rendering, and current-location state wiring.
- Create `src/components/EditTripModal.tsx`: render the trip metadata modal using existing modal styles.
- Modify `src/styles/layout.css`: add two-row planner header layout.
- Modify `src/styles/components/map.css`: style the bottom-right current-location map control.
- Modify `src/styles/mobile.css`: preserve compact mobile header behavior and keep the map control above the mobile sheet.

## Task 1: Lock Header Contract

- [ ] Add tests in `tests/trip-planner-app.test.ts` that render owner and editor planner states. Assert owner markup contains `app-header-title-row`, `app-header-action-row`, and `Edit trip`; assert editor markup does not contain `Edit trip`.
- [ ] Run `npm test -- tests/trip-planner-app.test.ts` and verify the new tests fail because the header rows and `Edit trip` action do not exist.

## Task 2: Add Edit Trip Modal

- [ ] Create `src/components/EditTripModal.tsx` with controlled fields for name, start date, end date, and timezone.
- [ ] Reuse `TimeZoneSelect`, `TripFormState`, and the existing modal class names.
- [ ] Use `Save changes` for the submit button and disable it while saving.

## Task 3: Wire Planner State

- [ ] Import `updateTrip`, timezone helpers, `TripMetadataPayload`, and the modal in `TripPlannerApp`.
- [ ] Track `editingTripForm` and `isSavingTrip`.
- [ ] Open the modal only when `role === "owner"` and `trip` is loaded.
- [ ] On save, call `updateTrip(tripId, payload)`, update local `trip`, close the modal, and clear errors.
- [ ] On failure, keep the modal open and show the existing planner error.

## Task 4: Split Header Layout

- [ ] In `PlannerPanel`, place `h1` and expand/collapse in `app-header-title-row`.
- [ ] Place action buttons in `app-header-action-row` ordered as add place, edit trip, log out.
- [ ] Keep mobile logout footer behavior unchanged unless the header row intentionally shows `Log out` on desktop only.

## Task 4B: Move Current Location To Map

- [ ] Remove the current-location button from `PlannerPanel`.
- [ ] Pass current-location state, toast, and toggle callback into `MapPanel`.
- [ ] Render a circular bottom-right `map-current-location-button` with `aria-label`, `aria-pressed`, and active styling.
- [ ] Offset the control above the mobile sheet and hide it when the sheet is full.

## Task 5: Verify

- [ ] Run `npm test`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
- [ ] Review `git diff` for unrelated changes before reporting.
