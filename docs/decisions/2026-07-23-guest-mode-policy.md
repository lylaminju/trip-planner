# Guest Mode Policy

## Decision

TripGlance offers a public guest mode with no sign-in. Guests plan real trips
in the full planner UI, backed by server-side ephemeral trips owned by an
anonymous guest principal.

- Guest identity is a signed, httpOnly guest cookie minted by the landing page.
- Guest trips are stored in Supabase like member trips and are deleted 48 hours
  after creation.
- Guest trips are reachable only with the same guest cookie; guest trip links
  are not shareable.
- Guests never see other users' trips, members, or profiles, and members never
  see guest trips in their dashboards.

## Entry points

- **Explore a sample trip**: clones a pre-made template trip, including cached
  route geometry, into a fresh guest-owned copy. Viewing the clone makes zero
  metered API calls.
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
| Routes calls per guest per day | 30 |
| Routes calls, global guest cap per day | 150 |
| Guest trip TTL | 48 hours |

The global caps bound worst-case spend at roughly $1 per day for OpenAI and $0
for Google Routes (4,500 guest calls per month plus member usage stays inside
the free tier). When a global cap is exhausted, the feature degrades with a
sign-in upsell instead of an error.

## Abuse posture

- Per-guest-cookie daily limits and global daily caps are enforced.
- The salted IP hash of each metered guest call is recorded on the usage row
  but not enforced. Enforcement can be enabled later if recorded data shows
  abuse concentrated on single networks.
- Guest API access requires a validly signed guest cookie; requests without one
  are rejected before reaching metered services.

## Analytics

Guest actions are recorded in a `guest_events` table (`guest_id`,
`event_name`, `metadata`, `created_at`): trip created, sample cloned, place
added, generation run, limit hit, upsell shown, upsell clicked. Raw IP
addresses are never stored.
