# AI Generation Loading Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the AI wizard body with centered trip-like loading icons while itinerary generation is running.

**Architecture:** Keep the change local to `AiPlanningWizard` and its CSS. Render a dedicated loading body when `isGenerating` is true, with the modal header and footer still present and disabled. Use inline SVG inside the wizard component, semantic CSS tokens, and a reduced-motion fallback.

**Tech Stack:** React, Next.js client component, Vitest server-side rendering tests, plain CSS with existing design tokens.

---

## File Structure

- Modify `tests/ai-planning-wizard.test.ts`: add a rendering regression test for the generating state.
- Modify `src/components/AiPlanningWizard.tsx`: add a body replacement branch and a small internal `AiGenerationLoadingIcons` component.
- Modify `src/styles/components/ai-planning-wizard.css`: center the loading icons, animate them subtly, and disable motion under `prefers-reduced-motion`.

### Task 1: Lock The Generating-State Contract

**Files:**

- Modify: `tests/ai-planning-wizard.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe("AiPlanningWizard", () => { ... })` block:

```ts
it("replaces wizard body with centered loading icons while generating", () => {
  const markup = renderToStaticMarkup(
    createElement(AiPlanningWizard, {
      setup: setup(),
      isLoading: false,
      error: null,
      isGenerating: true,
      onCancel: vi.fn(),
      onCreateItinerary: vi.fn(),
    }),
  );

  expect(markup).toContain('class="ai-generation-loading"');
  expect(markup).toContain('role="status"');
  expect(markup).toContain("Creating itinerary");
  expect(markup).toContain('class="ai-generation-icons"');
  expect(markup).not.toContain("Step 1 of 4");
  expect(markup).not.toContain("Visits per day");
  expect(markup).not.toContain("Creating...");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/ai-planning-wizard.test.ts
```

Expected: FAIL because `ai-generation-loading` is not rendered and the old `Creating...` button text is still present.

### Task 2: Implement The Full Body Replacement

**Files:**

- Modify: `src/components/AiPlanningWizard.tsx`
- Modify: `src/styles/components/ai-planning-wizard.css`
- Test: `tests/ai-planning-wizard.test.ts`

- [ ] **Step 1: Replace the wizard body when generating**

In `src/components/AiPlanningWizard.tsx`, render `AiGenerationLoadingIcons` instead of the step nav and step panel when `props.isGenerating` is true:

```tsx
{
  !props.isLoading &&
    !props.error &&
    props.setup &&
    (props.isGenerating ? (
      <AiGenerationLoadingIcons />
    ) : (
      <>
        <nav className="ai-wizard-steps" aria-label="AI planning steps">
          {STEPS.map((step, index) => (
            <span
              key={step}
              className={
                index === stepIndex
                  ? "ai-wizard-step current"
                  : "ai-wizard-step"
              }
            >
              {step}
            </span>
          ))}
        </nav>

        <section className="ai-wizard-step-panel">
          <p className="ai-wizard-step-count">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
          {stepIndex === 0 && <PaceStep draft={draft} onChange={setDraft} />}
          {stepIndex === 1 && (
            <InterestStep draft={draft} onChange={setDraft} />
          )}
          {stepIndex === 2 && (
            <LogisticsStep
              currentLodging={props.setup.lodging}
              dailyStartTime={dailyStartTime}
              draft={draft}
              lodgingGoogleMapsUrl={lodgingGoogleMapsUrl}
              onChange={setDraft}
              onDailyStartTimeChange={setDailyStartTime}
              onLodgingGoogleMapsUrlChange={setLodgingGoogleMapsUrl}
            />
          )}
          {stepIndex === 3 && (
            <MustSeeStep
              candidates={props.setup.candidates}
              draft={draft}
              onChange={setDraft}
            />
          )}
        </section>
      </>
    ));
}
```

- [ ] **Step 2: Add the internal icon-loading component**

Add this component below `AiPlanningWizard` in `src/components/AiPlanningWizard.tsx`:

```tsx
function AiGenerationLoadingIcons() {
  return (
    <div
      className="ai-generation-loading"
      role="status"
      aria-label="Creating itinerary"
    >
      <div className="ai-generation-icons" aria-hidden="true">
        <svg className="ai-generation-icon" viewBox="0 0 32 32">
          <path d="M16 28s9-7.4 9-16A9 9 0 0 0 7 12c0 8.6 9 16 9 16Z" />
          <circle cx="16" cy="12" r="3.5" />
        </svg>
        <svg className="ai-generation-icon" viewBox="0 0 32 32">
          <path d="M7 22c4.5-8 14-2 18-10" />
          <circle cx="7" cy="22" r="2.5" />
          <circle cx="25" cy="12" r="2.5" />
        </svg>
        <svg className="ai-generation-icon" viewBox="0 0 32 32">
          <path d="M9 6v4" />
          <path d="M23 6v4" />
          <path d="M6 10h20v16H6z" />
          <path d="M6 15h20" />
          <path d="m12 21 3 3 6-7" />
        </svg>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Remove the button-level generating copy**

In the primary submit button, replace the nested `props.isGenerating ? "Creating..." : "Create itinerary"` copy with stable final-step copy:

```tsx
{
  stepIndex === STEPS.length - 1 ? "Create itinerary" : "Next";
}
```

- [ ] **Step 4: Add centered loading and motion CSS**

Append this CSS to `src/styles/components/ai-planning-wizard.css`:

```css
.ai-generation-loading {
  align-items: center;
  display: flex;
  justify-content: center;
  min-height: 260px;
}

.ai-generation-icons {
  align-items: center;
  color: var(--accent);
  display: flex;
  gap: 14px;
  justify-content: center;
}

.ai-generation-icon {
  animation: ai-generation-icon-pulse 1.2s ease-in-out infinite;
  fill: none;
  height: 34px;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  width: 34px;
}

.ai-generation-icon:nth-child(2) {
  animation-delay: 0.18s;
}

.ai-generation-icon:nth-child(3) {
  animation-delay: 0.36s;
}

@keyframes ai-generation-icon-pulse {
  0%,
  100% {
    opacity: 0.38;
    transform: translateY(0);
  }

  45% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ai-generation-icon {
    animation: none;
    opacity: 1;
  }
}
```

- [ ] **Step 5: Run targeted test to verify it passes**

Run:

```bash
npm test -- tests/ai-planning-wizard.test.ts
```

Expected: PASS.

### Task 3: Verify The Change

**Files:**

- Verify: `tests/ai-planning-wizard.test.ts`
- Verify: `src/components/AiPlanningWizard.tsx`
- Verify: `src/styles/components/ai-planning-wizard.css`

- [ ] **Step 1: Run the project test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run the TypeScript check**

Run:

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Review the final diff**

Run:

```bash
git diff -- tests/ai-planning-wizard.test.ts src/components/AiPlanningWizard.tsx src/styles/components/ai-planning-wizard.css docs/superpowers/plans/2026-07-08-ai-generation-loading-icons.md
```

Expected: diff is limited to the approved loading-state implementation and this plan.
