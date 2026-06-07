# Trip Planner Agent Guide

This file applies to the whole repository. Follow it when changing code here.

## Architecture Boundaries

- Keep React container components focused on state ownership, effects, and wiring.
- Move repeated JSX rows, pickers, panels, and section bodies into sibling component files.
- Put browser integration details behind focused modules, for example `src/components/map-panel/*`.
- Put reusable data and API helpers in `src/lib/*`; keep component files free of raw fetch contract details when the contract is shared or verbose.
- Put reusable hooks in `src/hooks/*`; hooks may own effects and related state transitions.

## State Shape Boundaries

- When adding server-loaded data or expanding an existing state object, verify that the type name still matches its ownership and update lifecycle.
- Do not mix stable page context, such as trip metadata or permissions, into mutable collection snapshots unless all producers and consumers intentionally share the same contract.
- Prefer separate state and types when data changes through different workflows:
  - Page context: trip metadata, role, auth-derived permissions.
  - Mutable planner data: places, itinerary items, route segments.
  - UI state: selection, modals, collapsed panels, loading/deleting flags.
- If a mutation response is used to replace client state, confirm whether it is a full replacement contract or a partial domain update. Rename types and functions when the distinction matters.

## File Size Guardrails

- Target new or edited source files under 300 lines.
- Files between 300 and 450 lines are acceptable only when they have a single clear responsibility.
- Do not grow files beyond 450 lines without splitting a subcomponent, helper module, or hook first.
- When touching an oversized file, leave it smaller or document why splitting would be riskier than the local edit.

## Refactoring Rules

- Preserve behavior first. Run existing tests and typecheck before and after behavior-preserving refactors.
- Prefer extraction over rewrites: move code to clearer files before changing logic.
- Avoid new dependencies unless the task explicitly requires one.
- Keep props typed at component boundaries. Do not replace precise domain types with broad `any` to make extraction easier.
- Keep CSS class names stable during structural refactors unless the task is explicitly visual.
- In mobile layouts, keep short labels, badges, and action buttons on the same row unless the text is expected to be long.

## Verification

- Standard checks after code changes: `npm test` and `npx tsc --noEmit`.
- Run `npm run build` when changes affect Next.js routing, server/client boundaries, environment-variable behavior, or production bundling.

## Commit Messages

- Use a short conventional subject, for example `feat: add scheduled itinerary export`.
- When useful, add a short body with a few concise bullet points.
- The current Codex/OMX guard may require one Lore-style trailer when the agent runs `git commit`; use the least noisy trailer that satisfies the guard.
- Do not include `Tested:` unless the user explicitly asks for verification details in the commit message.
- Do not add `Co-authored-by` trailers unless the user explicitly asks for them.
