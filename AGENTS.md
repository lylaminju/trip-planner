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
- Do not introduce deprecated APIs, types, or framework patterns. When touching
  recently updated libraries such as React or Next.js, verify current types and
  docs instead of copying older repo usage blindly.
- Keep props typed at component boundaries. Do not replace precise domain types with broad `any` to make extraction easier.
- Keep CSS class names stable during structural refactors unless the task is explicitly visual.
- In mobile layouts, keep short labels, badges, and action buttons on the same row unless the text is expected to be long.

## Code Health Guardrails

- Do not commit scratch files or one-off probe files. Keep temporary experiments outside the repo, or convert them into real tests or documentation before committing.
- Treat request-derived strings as untrusted input. Parsing helpers for cookies, URLs, headers, and form data should fail closed, and malformed-input regression tests are required when they affect auth, routing, or persistence.
- Keep exported return types limited to the production contract. Do not expose fields used only by tests. If a preservation or detail field is an intentional API, production code should consume it or tests should clearly document the contract.
- When touching files over the file-size guardrail, extract a focused hook, helper, or subcomponent as part of the change unless that would make the diff materially riskier.

## UI Layout Stability

- Avoid expected layout shifts during normal user workflows. When labels, durations, counts, badges, loading states, or option text can vary, reserve stable space for repeated controls where practical.
- When expanding/collapsing content or conditionally rendering sections can cross the viewport height threshold, prevent horizontal page shifts from scrollbar appearance/disappearance. Prefer a stable root scrollbar gutter, such as `scrollbar-gutter: stable`, before adding layout-specific compensation.
- Keep repeated row actions in consistent columns so scanning stays predictable. Prefer fixed or bounded columns, tabular numerals, placeholders that preserve space, and right-aligned numeric metadata over letting action buttons drift horizontally.
- Do not reserve excessive empty space for rare outliers. Size stable columns around the longest common display value, then allow wrapping or overflow handling only for genuinely unusual content.

## CSS Cascade Rules

- When static previews or landing pages reuse app component classes, verify `src/app/globals.css` import order before relying on overrides.
- Do not rely on equal-specificity overrides across component CSS files; scope through the preview container or use the exact combined class.
- Avoid broad descendant element selectors such as `.component span` or `.component > span:not(...)` for component rows that may contain nested icons, badges, metadata, or featured/variant styling. Give each semantic child its own class and target that class directly.
- Prefer component-level CSS custom properties or explicit variant classes over deep descendant selector chains when styling variants and interactive states.
- If a selector crosses more than one component ownership boundary, first consider moving the variant values to the owning component and keeping state selectors close to the reusable control.
- Prefer preview-owned classes when a static preview should not inherit live app spacing, interaction, or layout behavior.

## CSS Design Tokens

- Define color, shadow, overlay, focus-ring, and map/SVG paint values in `src/styles/theme.css`.
- Do not put raw `#hex`, `rgb()`, or `rgba()` color values in component CSS or inline React styles. Use semantic custom properties such as `--surface-muted`, `--border-strong`, `--focus-ring`, or `--danger-bg`.
- Prefer semantic role tokens over literal palette names in component CSS. A component should ask for a role such as selected border, hover surface, or floating shadow, not a numbered gray.
- Keep token additions intentional. Add a new token only when an existing role does not describe the use case clearly.
- Allowed exceptions outside `theme.css`: `transparent`, `currentColor`, non-color numeric values, and third-party asset data that cannot reasonably use CSS variables.

## Testing Guidelines

- Tests must exercise the production implementation, not a copied helper or reimplemented version of the same logic. If script logic needs tests, extract the logic into an importable helper and keep the executable wrapper thin.
- Prefer assertions that protect stable behavior, structure, routing, and integration contracts over assertions that freeze incidental UI copy.
- Avoid implementation-specific tests that assert raw CSS selectors, source text, or internal markup details unless that exact structure is a durable contract. Prefer behavior, accessibility, computed output, or user-visible affordances.
- Do not add tests that only restate behavior already covered at the same layer; new tests should protect a new branch, regression risk, or integration contract.
- Prefer the narrowest test that proves the behavior under change. Avoid duplicate coverage across utility, component, and integration layers unless each layer catches a distinct failure mode.
- Avoid `not.toContain()` checks for removed marketing text, placeholder text, or helper copy unless the absence is a real product requirement or safety constraint.
- Before adding `not.toContain()` or `not.toMatch()` in tests, state the product contract or safety constraint it protects. If the absence is not user-facing or safety-critical, use a positive assertion for the durable affordance instead.
- When copy is expected to change during design iteration, assert the durable affordance instead, for example the CTA link target, form field name, route id, component class, or accessible landmark.
- Keep CSS/source-text assertions coarse and intentional: assert a small invariant that would break a user-facing contract, not a full implementation recipe or every declaration in a rule.
- When the same domain fixture or markup/CSS helper appears in several test files, move it to a typed test helper instead of growing copy-pasted builders.
- Do not leave `passWithNoTests` enabled unless a package genuinely supports a no-test mode; test discovery should fail closed in this app.

## Verification

- Standard checks after code changes: `npm test` and `npx tsc --noEmit`.
- Run `npm run build` when changes affect Next.js routing, server/client boundaries, environment-variable behavior, or production bundling.

## Commit Messages

- Use a short conventional subject, for example `feat: add scheduled itinerary export`.
- When useful, add a short body with a few concise bullet points.
- The current Codex/OMX guard may require one Lore-style trailer when the agent runs `git commit`; use the least noisy trailer that satisfies the guard.
- Do not include `Tested:` unless the user explicitly asks for verification details in the commit message.
- Do not add `Co-authored-by` trailers unless the user explicitly asks for them.
