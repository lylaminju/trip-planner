# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the issue #11 public landing page while preserving invite-only login behavior.

**Architecture:** Keep `/login` as the unauthenticated entry route, but replace the sign-in-only screen with a landing page that embeds the existing login form as a secondary section. Split static landing UI into focused sibling components under `src/components/landing/` so `LoginPage.tsx` remains the client-owned auth/form container.

**Tech Stack:** Next.js App Router, React 19, TypeScript, native CSS, Vitest server-render checks.

---

## File Structure

- Modify: `src/components/LoginPage.tsx`
  - Keeps client state, `handleSubmit`, error handling, and login redirect.
  - Renders landing shell, passes sign-in form markup into a secondary section.
- Create: `src/components/landing/LandingHero.tsx`
  - Header, hero copy, CTA links, and hero product preview composition.
- Create: `src/components/landing/SampleTripPreview.tsx`
  - Static faithful planner/map preview with itinerary items, route segment rows, external-link icon, markers, and route lines.
- Create: `src/components/landing/LandingFeatureProof.tsx`
  - Short concrete proof section for saved places, daily timeline, route segments, and map view.
- Create: `src/components/landing/LandingAccessNote.tsx`
  - Secondary access/sign-in context and future demo-video placeholder copy.
- Modify: `src/styles/components/auth.css`
  - Replace centered-card-only auth styling with landing-page styles while preserving form control classes.
- Create: `tests/login-page.test.ts`
  - Server-render checks for CTA hierarchy, mailto access request, sample/sign-in anchors, route segment preview, and login form preservation.

## Task 1: Lock Landing Page Contract With Tests

**Files:**
- Create: `tests/login-page.test.ts`
- Read: `src/components/LoginPage.tsx`

- [ ] **Step 1: Write failing render tests**

Create `tests/login-page.test.ts`:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LoginPage } from "@/components/LoginPage";

describe("LoginPage landing page", () => {
  it("renders public landing CTAs with request access as the primary action", () => {
    const markup = renderToStaticMarkup(createElement(LoginPage));

    expect(markup).toContain("Trip Planner");
    expect(markup).toContain("Request access");
    expect(markup).toContain("View sample trip");
    expect(markup).toContain('href="#sample-trip"');
    expect(markup).toContain('href="#sign-in"');
    expect(markup).toContain("mailto:mjuudev%40gmail.com");
    expect(markup).toContain("Trip%20Planner%20access%20request");
  });

  it("shows a faithful planner preview with route segment rows", () => {
    const markup = renderToStaticMarkup(createElement(LoginPage));

    expect(markup).toContain("Weekend trip, 4 days");
    expect(markup).toContain("Day 2");
    expect(markup).toContain("09:30 First stop");
    expect(markup).toContain("11:10 Lunch stop");
    expect(markup).toContain("14:20 Afternoon walk");
    expect(markup).toContain("landing-route-segment");
    expect(markup).toContain("walking");
    expect(markup).toContain("transit");
    expect(markup).toContain("18 min");
    expect(markup).toContain("22 min");
    expect(markup).toContain("ExternalLinkIcon");
    expect(markup).not.toContain("Morning route");
    expect(markup).not.toContain("Walking · 3 places");
  });

  it("keeps the existing sign-in form on the same page", () => {
    const markup = renderToStaticMarkup(createElement(LoginPage));

    expect(markup).toContain('id="sign-in"');
    expect(markup).toContain("<h2>Sign in</h2>");
    expect(markup).toContain('name="email_local"');
    expect(markup).toContain('name="email_domain"');
    expect(markup).toContain('name="password"');
    expect(markup).toContain("Access is limited to manually created accounts.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/login-page.test.ts
```

Expected: fail because the current page only renders the existing centered sign-in card and does not include the landing CTAs or preview.

## Task 2: Extract Static Landing Preview Components

**Files:**
- Create: `src/components/landing/SampleTripPreview.tsx`
- Create: `src/components/landing/LandingFeatureProof.tsx`
- Create: `src/components/landing/LandingAccessNote.tsx`
- Modify: `tests/login-page.test.ts`

- [ ] **Step 1: Create `SampleTripPreview.tsx`**

Create `src/components/landing/SampleTripPreview.tsx`:

```tsx
import { ExternalLinkIcon } from "@/components/Icons";

export function SampleTripPreview() {
  return (
    <section className="landing-preview" id="sample-trip" aria-labelledby="sample-trip-title">
      <div className="landing-preview-copy">
        <p className="landing-section-label">Sample trip</p>
        <h2 id="sample-trip-title">A planner view that matches the map.</h2>
        <p>
          The preview uses the same core pieces as the app: dated visits, route
          segments between visits, and map routes for the selected day.
        </p>
      </div>

      <div className="landing-product-frame" aria-label="Sample planner and map preview">
        <div className="landing-planner-panel">
          <p className="landing-trip-name">Weekend trip, 4 days</p>
          <div className="landing-day-card">
            <p className="landing-day-label">Day 2</p>
            <ItineraryStop time="09:30" name="First stop" active />
            <RouteSegment mode="walking" duration="18 min" />
            <ItineraryStop time="11:10" name="Lunch stop" />
            <RouteSegment mode="transit" duration="22 min" />
            <ItineraryStop time="14:20" name="Afternoon walk" />
          </div>
        </div>

        <div className="landing-map-panel" aria-hidden="true">
          <svg className="landing-map-lines" viewBox="0 0 360 260" role="img">
            <path className="landing-map-road" d="M32 58 C88 32 114 96 166 76 S246 42 318 76" />
            <path className="landing-map-road" d="M58 202 C116 158 154 214 208 172 S282 130 324 172" />
            <path className="landing-map-route" d="M64 66 C108 98 140 90 178 116 C228 150 254 132 312 168" />
            <circle className="landing-map-marker" cx="64" cy="66" r="10" />
            <circle className="landing-map-marker" cx="178" cy="116" r="10" />
            <circle className="landing-map-marker" cx="312" cy="168" r="10" />
          </svg>
        </div>
      </div>
    </section>
  );
}

function ItineraryStop({
  time,
  name,
  active = false,
}: {
  time: string;
  name: string;
  active?: boolean;
}) {
  return (
    <div className={`landing-itinerary-stop ${active ? "active" : ""}`}>
      <span>{time}</span>
      <strong>{name}</strong>
    </div>
  );
}

function RouteSegment({ mode, duration }: { mode: string; duration: string }) {
  return (
    <div className="landing-route-segment">
      <span className="landing-route-mode">{mode}</span>
      <span>{duration}</span>
      <span className="landing-route-map-link" aria-label="Open in Google Maps">
        <ExternalLinkIcon />
      </span>
      <span className="sr-only">ExternalLinkIcon</span>
    </div>
  );
}
```

- [ ] **Step 2: Create `LandingFeatureProof.tsx`**

Create `src/components/landing/LandingFeatureProof.tsx`:

```tsx
const FEATURES = [
  {
    title: "Saved places",
    body: "Start with places and map links, then decide when each visit belongs.",
  },
  {
    title: "Daily timeline",
    body: "Group visits by date and keep the day readable as plans change.",
  },
  {
    title: "Route segments",
    body: "Choose travel mode between consecutive visits without leaving the plan.",
  },
  {
    title: "Map view",
    body: "Use markers and route lines to check whether the day makes sense visually.",
  },
];

export function LandingFeatureProof() {
  return (
    <section className="landing-feature-proof" aria-label="Trip Planner feature summary">
      {FEATURES.map((feature) => (
        <article key={feature.title} className="landing-feature-item">
          <h2>{feature.title}</h2>
          <p>{feature.body}</p>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Create `LandingAccessNote.tsx`**

Create `src/components/landing/LandingAccessNote.tsx`:

```tsx
export function LandingAccessNote() {
  return (
    <section className="landing-access-note" aria-labelledby="early-access-title">
      <div>
        <p className="landing-section-label">Early access</p>
        <h2 id="early-access-title">Request access now. Watch a real demo later.</h2>
      </div>
      <p>
        Accounts are invite-only while Trip Planner is prepared for public use.
        This section can hold a short recorded demo once the video exists.
      </p>
    </section>
  );
}
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
npm test -- tests/login-page.test.ts
```

Expected: still fail until `LoginPage` renders the new components.

## Task 3: Build Landing Hero and Wire LoginPage

**Files:**
- Create: `src/components/landing/LandingHero.tsx`
- Modify: `src/components/LoginPage.tsx`
- Test: `tests/login-page.test.ts`

- [ ] **Step 1: Create `LandingHero.tsx`**

Create `src/components/landing/LandingHero.tsx`:

```tsx
import { SampleTripPreview } from "./SampleTripPreview";

const ACCESS_EMAIL = "mjuudev@gmail.com";
const ACCESS_SUBJECT = "Trip Planner access request";
const ACCESS_BODY =
  "Hi, I would like to request access to Trip Planner.";

export const requestAccessHref = `mailto:${encodeURIComponent(
  ACCESS_EMAIL,
)}?subject=${encodeURIComponent(ACCESS_SUBJECT)}&body=${encodeURIComponent(
  ACCESS_BODY,
)}`;

export function LandingHero() {
  return (
    <>
      <header className="landing-header">
        <a className="landing-brand" href="#top" aria-label="Trip Planner home">
          Trip Planner
        </a>
        <nav className="landing-nav" aria-label="Landing page">
          <a href="#sample-trip">Sample trip</a>
          <a href="#sign-in">Sign in</a>
        </nav>
      </header>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <h1>See the itinerary and the route at the same time.</h1>
          <p>
            Build each day from saved places, then check the map before the plan
            gets messy.
          </p>
          <div className="landing-hero-actions">
            <a className="landing-primary-action" href={requestAccessHref}>
              Request access
            </a>
            <a className="landing-secondary-action" href="#sample-trip">
              View sample trip
            </a>
          </div>
          <p className="landing-access-copy">
            Invite-only while accounts are manually created.
          </p>
        </div>
        <SampleTripPreview />
      </section>
    </>
  );
}
```

- [ ] **Step 2: Modify `LoginPage.tsx`**

Replace the current return block in `src/components/LoginPage.tsx` with a landing layout while preserving state and `handleSubmit`:

```tsx
  return (
    <main className="login-shell landing-shell">
      <LandingHero />
      <LandingFeatureProof />
      <LandingAccessNote />

      <section className="login-card landing-sign-in" id="sign-in" aria-labelledby="sign-in-title">
        <div className="login-copy">
          <p className="login-kicker">Existing users</p>
          <h2 id="sign-in-title">Sign in</h2>
          <p>Access is limited to manually created accounts.</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <span className="login-email-row">
              <input
                autoComplete="email"
                className="login-email-local"
                name="email_local"
                type="text"
                value={emailLocalPart}
                onChange={(event) =>
                  setEmailLocalPart(event.currentTarget.value)
                }
              />
              <span className="login-email-at" aria-hidden="true">
                @
              </span>
              <input
                className="login-email-domain"
                name="email_domain"
                type="text"
                value={emailDomain}
                onChange={(event) => setEmailDomain(event.currentTarget.value)}
              />
            </span>
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
```

Add imports at the top:

```tsx
import { LandingAccessNote } from "./landing/LandingAccessNote";
import { LandingFeatureProof } from "./landing/LandingFeatureProof";
import { LandingHero } from "./landing/LandingHero";
```

- [ ] **Step 3: Run the focused test**

Run:

```bash
npm test -- tests/login-page.test.ts
```

Expected: pass once the new components render and the existing form remains.

## Task 4: Add Landing Styles

**Files:**
- Modify: `src/styles/components/auth.css`
- Test: `tests/login-page.test.ts`

- [ ] **Step 1: Replace shell/card-only auth layout with landing layout**

Modify `src/styles/components/auth.css` so these selectors exist. Keep the existing `.login-form`, `.login-email-row`, `.login-form input`, and error styles compatible with the form:

```css
.landing-shell {
  align-items: stretch;
  background:
    radial-gradient(circle at 18% 8%, rgba(15, 118, 110, 0.12), transparent 30%),
    linear-gradient(180deg, #ffffff 0%, var(--bg) 100%);
  display: grid;
  gap: 56px;
  justify-content: stretch;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 24px;
}

.landing-header {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  margin: 0 auto;
  max-width: 1120px;
  width: 100%;
}

.landing-brand {
  color: var(--text);
  font-weight: 800;
  text-decoration: none;
}

.landing-nav {
  align-items: center;
  display: flex;
  gap: 14px;
  justify-content: flex-end;
}

.landing-nav a,
.landing-secondary-action {
  color: var(--muted);
  font-weight: 700;
  text-decoration: none;
}

.landing-hero {
  align-items: center;
  display: grid;
  gap: 28px;
  grid-template-columns: minmax(0, 0.82fr) minmax(520px, 1.18fr);
  margin: 0 auto;
  max-width: 1120px;
  width: 100%;
}

.landing-hero-copy {
  display: grid;
  gap: 16px;
}

.landing-hero h1 {
  font-size: clamp(40px, 7vw, 76px);
  letter-spacing: -0.03em;
  line-height: 0.96;
  margin: 0;
  max-width: 11ch;
  text-wrap: balance;
}

.landing-hero-copy > p {
  color: #475569;
  font-size: 17px;
  line-height: 1.5;
  margin: 0;
  max-width: 38ch;
}

.landing-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.landing-primary-action,
.landing-secondary-action {
  align-items: center;
  border-radius: 6px;
  display: inline-flex;
  font-weight: 800;
  justify-content: center;
  min-height: 42px;
  padding: 10px 14px;
}

.landing-primary-action {
  background: var(--accent);
  color: #ffffff;
  text-decoration: none;
}

.landing-secondary-action {
  background: #ffffff;
  border: 1px solid var(--line);
  color: var(--text);
}

.landing-access-copy {
  color: var(--muted);
  font-size: 13px;
}

.landing-preview {
  display: grid;
  gap: 14px;
}

.landing-hero .landing-preview-copy {
  display: none;
}

.landing-preview-copy,
.landing-feature-proof,
.landing-access-note,
.landing-sign-in {
  margin: 0 auto;
  max-width: 1120px;
  width: 100%;
}

.landing-product-frame {
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 16px;
  display: grid;
  grid-template-columns: minmax(220px, 0.44fr) minmax(0, 0.56fr);
  min-height: 280px;
  overflow: hidden;
}

.landing-planner-panel {
  border-right: 1px solid var(--line);
  display: grid;
  gap: 10px;
  padding: 14px;
}

.landing-trip-name,
.landing-section-label,
.landing-day-label {
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
  margin: 0;
}

.landing-day-card {
  border: 1px solid var(--line);
  border-radius: 8px;
  display: grid;
  gap: 7px;
  padding: 10px;
}

.landing-itinerary-stop {
  border-left: 3px solid #94a3b8;
  color: #334155;
  display: grid;
  gap: 2px;
  padding: 4px 0 4px 8px;
}

.landing-itinerary-stop.active {
  border-left-color: var(--accent);
}

.landing-itinerary-stop span,
.landing-route-segment {
  color: var(--muted);
  font-size: 12px;
}

.landing-route-segment {
  align-items: center;
  border-left: 1px solid var(--line);
  display: flex;
  gap: 7px;
  margin-left: 8px;
  padding: 4px 0 4px 8px;
}

.landing-route-mode,
.landing-route-map-link {
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--text);
  padding: 3px 6px;
}

.landing-route-map-link {
  align-items: center;
  display: inline-flex;
  justify-content: center;
}

.landing-route-map-link svg {
  height: 12px;
  width: 12px;
}

.landing-map-panel {
  background: linear-gradient(135deg, #e8f1ef, #eef2f6);
  min-height: 280px;
}

.landing-map-lines {
  display: block;
  height: 100%;
  width: 100%;
}

.landing-map-road,
.landing-map-route {
  fill: none;
  stroke-linecap: round;
}

.landing-map-road {
  stroke: #cbd5e1;
  stroke-width: 10;
}

.landing-map-route {
  stroke: var(--accent);
  stroke-width: 5;
}

.landing-map-marker {
  fill: var(--accent);
  stroke: #ffffff;
  stroke-width: 3;
}

.landing-feature-proof {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.landing-feature-item {
  border-top: 1px solid var(--line);
  padding-top: 12px;
}

.landing-feature-item h2,
.landing-access-note h2 {
  font-size: 18px;
  margin: 0 0 6px;
}

.landing-feature-item p,
.landing-access-note p,
.landing-preview-copy p {
  color: var(--muted);
  line-height: 1.5;
  margin: 0;
}

.landing-access-note {
  align-items: start;
  border: 1px solid var(--line);
  border-radius: 12px;
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  padding: 18px;
}

.landing-sign-in {
  max-width: 460px;
}

.login-copy h2 {
  font-size: 32px;
  line-height: 1;
  margin: 0 0 8px;
}

.sr-only {
  clip: rect(0, 0, 0, 0);
  border: 0;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}

@media (max-width: 900px) {
  .landing-shell {
    gap: 36px;
    padding: 18px 14px;
  }

  .landing-header {
    align-items: flex-start;
  }

  .landing-nav {
    flex-wrap: wrap;
  }

  .landing-hero,
  .landing-access-note {
    grid-template-columns: 1fr;
  }

  .landing-hero h1 {
    font-size: clamp(38px, 13vw, 58px);
  }

  .landing-product-frame {
    grid-template-columns: 1fr;
  }

  .landing-planner-panel {
    border-bottom: 1px solid var(--line);
    border-right: 0;
  }

  .landing-feature-proof {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .landing-feature-proof {
    grid-template-columns: 1fr;
  }

  .login-email-row {
    grid-template-columns: minmax(0, 1fr) auto minmax(96px, 120px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-shell *,
  .landing-shell *::before,
  .landing-shell *::after {
    scroll-behavior: auto;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Run focused test**

Run:

```bash
npm test -- tests/login-page.test.ts
```

Expected: pass. CSS changes should not break static render output.

## Task 5: Verify And Commit Implementation

**Files:**
- Modify: all files from Tasks 1-4

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: Next.js production build succeeds.

- [ ] **Step 4: Inspect changed files**

Run:

```bash
git diff --stat
git status --short
```

Expected: only the implementation files and test file are modified/untracked. Generated `.agents/`, `.claude/`, `.gemini/`, and `.kiro/` directories remain uncommitted unless the user explicitly wants to keep project-local Impeccable installation artifacts.

- [ ] **Step 5: Commit implementation**

Use the commit message format approved by the repo. If the local hook requires an OmX co-author trailer but the user still does not want it, stop and ask for the exact commit path.

Suggested message:

```text
feat: add public landing page for access requests

Replace the sign-in-only unauthenticated page with a public landing surface that explains the planner through a faithful static preview while keeping existing login behavior on the same page.

Constraint: Accounts remain invite-only and manually created
Rejected: Public demo route | requires unauthenticated sample data and access-boundary work outside issue 11
Confidence: high
Scope-risk: moderate
Tested: npm test; npx tsc --noEmit; npm run build
```

## Self-Review

- Spec coverage: tasks cover request-access mailto, same-page sign-in, sample-trip anchors, faithful route segment preview, visual system, and verification commands.
- Placeholder scan: no `TBD`, `TODO`, or "implement later" instructions remain.
- Type consistency: components use only React JSX, existing `ExternalLinkIcon`, and string props defined in the same file.
