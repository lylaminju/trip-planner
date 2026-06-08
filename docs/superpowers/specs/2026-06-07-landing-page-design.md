# Landing Page Design

## Issue

- GitHub issue: https://github.com/lylaminju/trip-planner/issues/11
- Goal: replace the first-page sign-in-only experience with a public landing page
  that previews the product, explains the core value briefly, and keeps access
  and sign-in paths clear.

## Confirmed Direction

Use the **Focused Console** landing direction from the brainstorming session.
The creative north star is **Connected Travel Console**: show Plotinerary as
one connected planning surface where itinerary timing, route segment controls,
and map routes are visible together.

This is a public brand-facing surface, but it must stay faithful to the current
product. The page should not imply signup, live navigation, public demo access,
collaboration, or route concepts that do not exist.

## Audience

- Public visitors evaluating the app before requesting invite-only access.
- Existing invite-only users who need to sign in.

The production service name is **Plotinerary**. The name was selected after the
landing-page direction was drafted; see
`docs/decisions/2026-06-08-service-name-plotinerary.md`.

## Primary Action

Primary CTA: **Request access**

- Opens an email to `mjuudev@gmail.com`.
- Use a prefilled subject/body suitable for an access request.
- Copy should make invite-only access clear without sounding like an error.

Existing-user action: **Sign in**

- Stays visible but secondary.
- Scrolls to or focuses the on-page sign-in form.
- Login submit behavior remains unchanged.

## Page Structure

1. Slim header
   - `Plotinerary` name.
   - `Sign in` anchor.

2. Hero
   - Concise product promise.
   - One short support sentence.
   - Primary `Request access` button.
   - Email-app microcopy for the access request.

3. Hero product preview
   - Static two-pane preview based on the current planner shape.
   - Left side: trip title, day bucket, itinerary item rows.
   - Route segment rows appear between mock visits.
   - Right side: map-like field with route lines and markers.

4. Short feature proof
   - Brief, concrete summaries only.
   - Suggested topics: Google Maps places, daily timeline, route segments, map view.
   - Avoid a generic repeated icon-card grid as the main proof.

5. Sign-in section
   - Contains the existing email/password form on the landing page.
   - Visually secondary to request access.
   - Preserve current login API behavior and error handling.

## Preview Fidelity Rules

The static preview may simplify the visual details, but it must represent current
app concepts accurately:

- Trips.
- Date/day buckets.
- Itinerary item rows.
- Route segment rows between visits.
- Travel mode control.
- Optional route duration.
- Google Maps external-link icon.
- Map markers.
- Route lines.

Do not include:

- Route summary badges that do not exist.
- Named route objects such as "Morning route".
- Live status, current navigation, or real-time claims.
- Public demo controls.
- Decorative travel illustrations that compete with the planner preview.

## Visual System

Use the project context captured in `PRODUCT.md` and `DESIGN.md`.

- Palette: light neutral product surfaces with deep teal as the action/selection
  accent.
- Typography: direct, readable, and scan-first.
- Copy: short, concrete, and product-specific.
- Motion: optional and minimal. Any animation must preserve visible content by
  default and support `prefers-reduced-motion`.
- Accessibility: target WCAG AA contrast, semantic structure, keyboard access,
  and visible focus states.

## Technical Scope

Likely implementation shape:

- Keep authenticated users redirected away from the public/auth page as today.
- Replace the current sign-in-only `LoginPage` with a landing page that includes
  the sign-in form as a section.
- Extract subcomponents if needed to keep files under project size guardrails.
- Keep shared auth form behavior intact.
- Add CSS in the existing native CSS structure, likely under the auth/landing
  component stylesheet or a focused new component stylesheet.

## Testing Expectations

Run after implementation:

- `npm test`
- `npx tsc --noEmit`
- `npm run build`

The build check is required because the work affects Next.js routing/auth entry
behavior and public page rendering.

## Out Of Scope

- Public signup.
- Waitlist database or backend lead capture.
- Real unauthenticated demo trip.
- Demo video production.
- Final production service naming.
- New dependencies.
