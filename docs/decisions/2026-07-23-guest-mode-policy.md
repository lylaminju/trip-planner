# Guest Mode Policy

## Decision

TripGlance offers a public guest mode with no sign-in. Guests plan real trips
in the full planner UI, backed by server-side ephemeral trips owned by an
anonymous guest principal.

- Guest identity is a signed, httpOnly guest cookie minted by the landing page.
- Guest trips are stored in Supabase like member trips and become unreachable
  48 hours after creation: guest access requires `expires_at > now`, so expired
  trips return 404 on every page and API route.
- Expired guest trip rows are retained, not deleted. Retained trips are the
  behavioral analytics record: they show what guests actually planned. There is
  no cleanup job; revisit retention if guest volume grows.
- Guest trips are reachable only with the same guest cookie; guest trip links
  are not shareable.
- Guests never see other users' trips, members, or profiles, and members never
  see guest trips in their dashboards.

## Entry points

- **Explore a sample trip**: clones a pre-made template trip into a fresh
  guest-owned copy. Viewing the clone makes zero metered API calls: the geometry
  cache is keyed by route rather than by place row, so the clone's segments read
  the rows the source trip already populated. Non-transit rows are shared
  outright; transit rows are shared per weekday-hour departure bucket, so a clone
  whose dates fall in an uncached bucket pays for those segments once.
- **Plan a trip**: a create form limited to the curated destination list, then
  the planner. Guests do not get a dashboard.

## Feature limits

Available to guests:

- Full planner editing: places, itinerary items, scheduling, route segments.
- AI itinerary generation using model knowledge only (no `web_search` tool).
- Destinations limited to the curated list whose AI catalogs are already cached
  in `ai_destination_candidates`: Bali, Banff National Park, Iceland,
  Los Angeles, New York City, Seoul, Toronto, Vancouver.
- Attraction candidates and transit hubs served from the cached catalogs.
- Trip length capped at 5 days.

Blocked for guests, with sign-in upsell shown at each locked feature:

- OpenAI `web_search` during generation.
- Destination catalog generation for new destinations.
- Google Places autocomplete, search, and details.
- Photo fetching for uncached photos.
- Trip members, invites, user lookup, and profile pages.

## Quota numbers

Basis, measured 2026-07-23:

- 49 itinerary generations recorded since 2026-07-08 averaged 6,800 input /
  1,138 output tokens (p90: 16,214 / 4,196), including `web_search` runs.
  At gpt-5.4-mini pricing ($0.75 per 1M input, $4.50 per 1M output tokens)
  one generation costs about 1¢ on average and about 3¢ at p90.
- Google Routes calls use the Compute Routes Essentials SKU (field mask:
  duration and polyline only), which has 10,000 free calls per month.
  Member usage over the prior 30 days totaled 346 calls.

Limits:

| Limit | Value |
| --- | --- |
| Guest trip length | 5 days |
| AI generations per guest per day | 5 |
| AI generations, global guest cap per day | 50 |
| Routes calls per guest per day | 100 |
| Routes calls, global guest cap per day | 300 |
| Guest trip TTL | 48 hours |

The global caps bound worst-case spend at roughly $1 per day for OpenAI. For
Google Routes the worst case is 9,300 guest calls in a 31-day month; added to
member usage at the measured 346 per 30 days, that stays inside the 10,000-call
free tier with roughly 350 calls of headroom. Sustained cap-saturating traffic
would therefore be the point at which Routes stops being free. When a global cap
is exhausted, the feature degrades with a sign-in upsell instead of an error.

## Abuse posture

- Per-guest-cookie daily limits and global daily caps are enforced.
- The salted IP hash of each metered guest call is recorded on the usage row
  but not enforced. Enforcement can be enabled later if recorded data shows
  abuse concentrated on single networks.
- Guest API access requires a validly signed guest cookie; requests without one
  are rejected before reaching metered services.

## Configuration

- `GUEST_SESSION_SECRET` signs the guest cookie. Guest mode, the landing
  demo CTAs, and `/try` stay disabled while it is unset.
- `GUEST_SAMPLE_TRIP_ID` names the trip cloned by "Explore a sample trip".
  Without it the landing page offers only the plan-your-own entry point.
- Guest quota rows live in `guest_api_usage`. Guest AI generations are also
  logged in `ai_plan_generations` with a null user id, keeping token cost
  visibility unified; quota counting for guests uses `guest_api_usage` only.
- Serving cached route geometry never consumes Routes quota, for guests or
  members; quota is asserted only on a geometry cache miss. Cached rows are
  shared across all trips travelling the same route, so one guest's lookup also
  spares the next guest's.
- AI generation asserts the AI generation budget only. Route lookups inside a
  generation are asserted per call, and an exhausted routes budget degrades the
  plan — fallback travel modes, no first-visit realignment — instead of blocking
  the run.
- Raised the per-guest routes limit from 30 to 100 and the global guest routes
  cap from 150 to 300 on 2026-07-29. One guest reached the previous per-guest
  limit of 30 in 16 minutes of normal planner editing and was then unable to
  generate a plan with all 5 AI generations still unused. Beta-period guests are
  sized as one-off visitors rather than daily returners, so the per-guest limit
  covers a single long editing session.

## Analytics

Guest actions are recorded in a `guest_events` table (`guest_id`,
`event_name`, `metadata`, `created_at`): trip created, sample cloned, place
added, generation run, limit hit, upsell shown, upsell clicked. Raw IP
addresses are never stored.

Developer-owned guest cookie UUIDs are listed in `internal_guests` and
excluded from guest activity analytics; their rows in `guest_events`,
`guest_api_usage`, and `trips` are retained, and quota enforcement still
counts them. Guest activity before 2026-07-26 21:00 America/Toronto was
developer testing and was backfilled into `internal_guests`, along with the
owner of trip 74.
