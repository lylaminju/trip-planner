---
target: current landing page
total_score: 24
p0_count: 0
p1_count: 2
timestamp: 2026-06-09T23-29-44Z
slug: src-components-landingpage-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | `Request access` leaves the site through mailto with no in-page confirmation or fallback. |
| 2 | Match System / Real World | 3 | Timeline plus map is clear, but terms like route segments and the split email field are system-facing. |
| 3 | User Control and Freedom | 2 | A failed mail app launch can strand a new visitor with no alternate request path. |
| 4 | Consistency and Standards | 3 | The app vocabulary is consistent, but inert preview controls look interactive. |
| 5 | Error Prevention | 2 | The sign-in form allows malformed split-email input and gives no invite-status cue. |
| 6 | Recognition Rather Than Recall | 3 | The product model is visible, but the sample-only state is not explicit enough. |
| 7 | Flexibility and Efficiency | 2 | Existing users can sign in, but new users have one brittle request route. |
| 8 | Aesthetic and Minimalist Design | 3 | The page is restrained, but the feature strip repeats what the preview should prove. |
| 9 | Error Recovery | 2 | Login failure is generic, with no forgot-password, access-help, or mailto fallback. |
| 10 | Help and Documentation | 2 | Invite-only expectations, response timing, and access requirements are unclear. |
| **Total** | | **24/40** | **Solid foundation, weak conversion and mobile proof** |

## Anti-Patterns Verdict

Does this look AI-generated? Not immediately. The page avoids the worst landing-page tells because it uses a real product-shaped planner and map preview, concise copy, familiar controls, and a restrained product palette.

The weaker signals are subtler: the four-column feature strip in `src/components/landing/LandingFeatureProof.tsx` reads like a default SaaS proof block, the teal radial glow in `src/styles/components/landing.css` is decorative rather than map-native, and the hero preview shows many inert controls that imply functionality without delivering it.

LLM assessment: low to moderate AI-slop risk. The page feels credible, but not yet sharp. It is strongest when it shows the connected planner and map. It is weakest when it explains features generically or exposes full app chrome inside a sample.

Deterministic scan: `detect.mjs` returned exit code `0` and `[]` for the source scan of `src/components/LandingPage.tsx`, `src/components/landing`, and `src/styles/components/landing.css`.

Visual overlays: browser evidence loaded `http://127.0.0.1:3001/` with no page errors and no failed requests. Mutable injection succeeded. The live overlay reported 14 browser-only findings: `ai-color-palette` 1, `low-contrast` 12, `overused-font` 1, `single-font` 1. The font findings are false positives because the project intentionally uses one product UI font. The low-contrast findings appear to be background-sampling false positives against gradients. The teal radial treatment is a real but low-severity signal.

## Overall Impression

The page has the right strategy but the wrong shape. The core proof is already there: a timeline, route details, and map markers in one connected object. The biggest opportunity is to restructure the landing page around that proof and bring the invite request path into the same first-viewport decision area.

## What's Working

- The product preview is the right centerpiece. It proves the value better than travel photography or abstract illustration.
- The copy is short and practical. It respects the product register and avoids long marketing exposition.
- The palette and control language mostly match the authenticated app, which helps the public page feel like the same product.

## Priority Issues

**[P1] Mobile preview looks broken**

Why it matters: the planner/map preview is the page's main trust signal. On mobile, fixed-width app controls and dense row actions risk clipping labels and controls, making the product feel unfinished.

Fix: build a purpose-made responsive preview instead of scaling the full app panel. On mobile, show one selected timeline row, one route-duration row, and one map route. Remove edit/delete icons, collapse toggles, drag handles, and fixed-width action columns from the preview.

Suggested command: `$impeccable adapt`

**[P1] Access request flow is too fragile**

Why it matters: the primary conversion depends on `mailto`. If the visitor has no configured email app, the request path can fail silently.

Fix: replace the CTA-only pattern with a compact access panel in the hero: primary `Request invite`, visible email fallback, expected response note, and a secondary `Already invited? Sign in` action. If there is no backend invite form yet, keep mailto but add copyable email and clearer next-step language.

Suggested command: `$impeccable onboard`

**[P2] The preview has false affordances**

Why it matters: visible route toggles, collapse buttons, drag handles, edit/delete buttons, travel-mode controls, and external-map buttons imply a live demo. Since they are inert, users must decide what is clickable and what is illustrative.

Fix: make the preview an intentional explanatory object. Keep only the elements that prove the core relationship: visit order, selected stop, route mode/duration, highlighted route, and matching markers. Label it as a sample planner view if needed, but avoid adding a lecture.

Suggested command: `$impeccable distill`

**[P2] Current information architecture gives the wrong ending**

Why it matters: public visitors need to understand invite access, but the page drifts from hero to generic feature strip to a sign-in form. The last strong action is for existing users, not new evaluators.

Fix: restructure the page into: slim header with request/sign-in, hero with product proof and access panel, short connected workflow proof, compact sign-in for invited users, footer. The four feature items can become a three-step workflow or be folded into the preview.

Suggested command: `$impeccable shape`

**[P3] Sign-in form is nonstandard**

Why it matters: existing users expect a single email field. Splitting local part and domain adds friction and creates validation edge cases.

Fix: use one `type="email"` input, clearer error copy, and a nearby access-help link for users who are not yet invited.

Suggested command: `$impeccable harden`

## Persona Red Flags

**First-time evaluator**: The preview is credible, but the primary action opens an email app and gives no fallback. If the preview clips on mobile, trust drops before the visitor requests access.

**Existing invited user**: The sign-in path exists, but the full form is below the product tour and uses an unusual split email pattern. A login failure does not explain whether the issue is password, invite status, or account access.

**Keyboard and screen-reader user**: The map proof is visually central but `aria-hidden`, while several preview controls are styled like controls using spans. The page communicates the planner-map relationship visually better than semantically.

## Minor Observations

- The header has `Sign in` but no matching persistent `Request access`.
- The hidden preview copy means the hero loses a chance to name what the preview is showing.
- The feature strip is clean, but it is the most generic part of the page.
- The decorative radial glow is not severe, but it is the least product-native visual choice.
- The footer does not reinforce the access path or support route.

## Questions to Consider

- What if the first viewport were one connected object: selected timeline row, highlighted route, and access request panel?
- Does the page need a feature section at all, or should the preview do that job?
- Should public visitors ever see the full sign-in form before they understand invite-only access?
