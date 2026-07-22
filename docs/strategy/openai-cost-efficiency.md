# OpenAI API Cost Efficiency

How the AI planning feature keeps OpenAI spend bounded and predictable. All
planner calls go through the [Responses API](https://platform.openai.com/docs/api-reference/responses)
with the model set by `OPENAI_AI_PLANNER_MODEL` (a mini-tier model;
[pricing](https://platform.openai.com/docs/pricing)).

## 1. Destination catalogs are generated once, ever, and shared

Attraction catalogs live in `ai_destination_candidates`, keyed by
`destinationCandidateKey(trip)` (`src/lib/ai-planning.ts`): the curated preset
slug when the trip has one, otherwise a stable key derived from country +
normalized name + coordinates rounded to one decimal (`custom-pt-lisbon-38.7,-9.1`).
Rounding groups every trip to the same city onto one key, so the catalog
generation cost is paid once per destination across all trips and all users,
then served from the database forever. The 7 originally curated destinations
were seeded by hand and never trigger a generation at all.

Failed generations are never cached: the sanitizer
(`src/server/openai-destination-catalog.ts`) rejects a response with fewer than
`AI_CATALOG_MIN_CANDIDATE_COUNT` (12) usable attractions, so a degenerate model
output cannot become a destination's permanent catalog.

## 2. The expensive call and the cheap call are split

| Call | prompt_version | Web search | Trigger | Frequency |
| --- | --- | --- | --- | --- |
| Attraction catalog (~40 candidates) | `ai-destination-catalog-v2` | Yes, capped | Wizard open, catalog missing | Once per destination |
| Transit hubs (≤5 hubs) | `ai-destination-transit-hubs-v1` | No | Wizard open, hubs missing | Once per destination |
| Itinerary generation | `ai-itinerary-v1` | No | "Create itinerary" | Per generation, ≤2 model calls |

Transit hubs (airports, stations) are stable facts, so their call runs on model
knowledge alone — no web-search billing, a few-hundred-token output, and a
~3-second response (measured 3,306 ms for Fukuoka) that unlocks the wizard's
Start & end step while the catalog is still building. Splitting duplicates only
the small request preamble (~1–2k input tokens once per destination).

## 3. Web searches are capped per catalog build

Each `web_search` tool round appends result snippets to the context, and every
subsequent pass re-reads the whole accumulated context, so token burn compounds
with search count. Uncapped, the model verified attractions one by one:
measured Fukuoka runs consumed ~23,000 tokens mid-flight and then requested
~17,000 more (~40k/attempt), colliding with the project's tokens-per-minute
limit and billing the burned tokens on every failed attempt.

The cap is enforced twice in `requestAiDestinationCatalog`:

- `max_tool_calls: AI_CATALOG_MAX_WEB_SEARCHES` (6) — a hard API-level ceiling
  ([tool docs](https://platform.openai.com/docs/guides/tools-web-search)).
- A prompt instruction to spend those searches on broad queries (top-attraction
  roundups, closed-attraction lists) instead of per-attraction checks, relying
  on model knowledge for well-established places.

Web search tool calls are billed per call on top of tokens, so the cap bounds
both meters. The accepted tradeoff: a recently closed minor attraction is less
likely to be caught than under per-attraction verification; the post-generation
banner already directs users to verify hours and venues before visiting.

## 4. Itinerary generation is bounded to two model calls

`generateAiItineraryForRequest` (`src/server/ai-planning-service.ts`) makes one
generation call; if server-side validation rejects the plan, exactly one repair
call runs with the validation errors attached. A second invalid response fails
the generation — there is no unbounded retry loop.

Structured outputs (`json_schema`, `strict: true`) on every call remove
parse-and-retry cycles: responses either match the schema or the request fails
once, cleanly.

## 5. Every call is rate-limited and logged

All three call types share one budget: `AI_GENERATION_DAILY_LIMIT` (30 rows per
user per day) counted from `ai_plan_generations`, where every call — including
catalog and hub builds — records its `prompt_version`, model, duration, token
counts, and failure reason. This makes per-feature cost visible in the admin
usage view and preserves upstream diagnostics: an OpenAI 429 reaches users as a
generic retry message but keeps OpenAI's full limit detail in the logged
`failure_reason`.

The OpenAI project caps the planner model's throughput
([rate limits](https://platform.openai.com/docs/guides/rate-limits)); the
project TPM for the planner model is set to 80,000, sized so one capped catalog
build plus a concurrent hub or itinerary call fit within a single minute.

## 6. Candidate images: one billed Google photo per attraction, ever

Catalog thumbnails come from Google Places, resolved inline during catalog
generation (`src/server/google-candidate-images.ts`) so candidates appear with
images the moment the catalog is ready. Per candidate:

1. Text Search masked to `places.id` — free IDs-Only SKU — resolves the place,
   biased to the destination coordinates.
2. An IDs-Only photo-reference lookup (`id,photos`) — also free.
3. One billed Place Photo media call (~$7/1,000) at 480px, stored in our
   `candidate-images` bucket with author attribution. Google is never called
   again for that candidate.

A 40-candidate destination therefore costs ~$0.28 in photos, once, shared by
every future trip there. The resolved `google_place_id` is persisted on the
candidate, powering Add-place dedup and photo reuse.

Photo calls draw from the same internal free-tier ceilings as the rest of the
app (`supabase-google-places-usage-store.ts`: 900 photos/month shared, 200
calls/user/day). Image resolution truncates to the remaining budget and fails
soft — candidates are left imageless rather than spilling into paid usage.
`scripts/backfill-candidate-images.mjs` (Wikimedia, $0) remains the manual
recovery path for imageless rows. See
`docs/strategy/place-photo-add-place-modal.md` for the field-mask SKU rules
this flow follows.
