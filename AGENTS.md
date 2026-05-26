# Trip Planner Agent Guide

This file applies to the whole repository. Follow it when changing code here.

## Architecture Boundaries

- Keep React container components focused on state ownership, effects, and wiring.
- Move repeated JSX rows, pickers, panels, and section bodies into sibling component files.
- Put browser integration details behind focused modules, for example `src/components/map-panel/*`.
- Put reusable data and API helpers in `src/lib/*`; keep component files free of raw fetch contract details when the contract is shared or verbose.
- Put reusable hooks in `src/hooks/*`; hooks may own effects and related state transitions.

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

## Verification

- Standard checks after code changes: `npm test` and `npx tsc --noEmit`.
- Run `npm run build` when changes affect Next.js routing, server/client boundaries, environment-variable behavior, or production bundling.
