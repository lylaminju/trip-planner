# AI Generation Loading Icons Design

## Context

After a user finishes the AI planning wizard and creates an itinerary, the modal
currently communicates generation progress through the final submit button text.
That makes the primary feedback feel small and button-bound during the longest
wait in the flow.

## Approved Direction

Use a full body replacement while AI generation is running.

When `isGenerating` is true, the modal keeps its white shell, header, and footer
structure, but the wizard body content is replaced by a centered loading
treatment. The visible loading treatment is only a compact sequence of
trip-like inline SVG icons. The previous wizard step content should not remain
visible behind or around the loading treatment.

## Interaction Details

- The footer controls remain present and disabled while generation is running.
- The submit button should no longer carry the main loading message.
- The centered loading treatment uses `role="status"` and an accessible label so
  screen readers receive useful progress feedback even though the visible
  treatment is icon-only.
- The icon sequence should feel map-native and practical: for example a place
  pin, a route line, and a calendar/checkpoint.
- Motion should be subtle, looping, and state-driven. The icons may pulse or
  advance in sequence, but should avoid decorative choreography.
- `prefers-reduced-motion: reduce` should disable the loop and leave a stable
  centered icon treatment.

## Component Boundaries

Keep the change inside `AiPlanningWizard` and its component CSS unless tests
show a small helper is warranted. Do not add dependencies. Use inline SVG or
existing local icon patterns.

## Testing

Add or update a focused wizard rendering test that proves:

- The generating state replaces the wizard step body.
- The centered loading status is present.
- The previous step content is not visible while generation is active.
- The submit button no longer renders `Creating...`.

Run the targeted test, then the standard project checks for this repository.
