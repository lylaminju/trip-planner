// Enforced quota ceilings for metered external APIs. Shared by the server
// modules that gate spending and the admin dashboard that displays them, so a
// limit is defined exactly once. Kept free of imports and side effects so
// client components can read it without pulling in server-only modules.

// --- AI generations ---

// Per signed-in account, counted from ai_plan_generations. Every OpenAI call
// type shares this one budget: itinerary, catalog, and hub builds alike.
export const AI_GENERATION_DAILY_LIMIT = 30;

// Friendly per-browser limits; honest guests should never notice them.
export const GUEST_AI_GENERATION_DAILY_LIMIT = 5;
export const GUEST_GOOGLE_ROUTES_DAILY_LIMIT = 100;

// Demo-wide caps across all guests: the hard bound on worst-case daily spend
// no matter how many cookies or networks an abuser rotates through.
export const GUEST_AI_GENERATION_GLOBAL_DAILY_CAP = 50;
export const GUEST_GOOGLE_ROUTES_GLOBAL_DAILY_CAP = 300;

// --- Google Routes ---

// Per signed-in account. Serving cached route geometry never draws from this;
// quota is asserted only on a cache miss.
export const GOOGLE_ROUTES_DAILY_LIMIT = 200;

// --- Google Places ---

// Google's free tier is per-SKU per-month and account-wide. We keep an internal
// ceiling below the real free limit (5,000 details / 10,000 autocomplete) so a
// burst near the boundary can never spill into paid usage.
export const PLACES_DETAILS_MONTHLY_LIMIT = 4500;
export const PLACES_AUTOCOMPLETE_MONTHLY_LIMIT = 9000;
// Place Photo has a much smaller (~1,000/month) free allotment than the other
// SKUs, so keep the internal ceiling well under it.
export const PLACES_PHOTO_MONTHLY_LIMIT = 900;
// Place Details Enterprise also has the small 1,000/month free allotment; the
// ceiling keeps a dev-loop spike from ever reaching billed lunch lookups.
// Lunch candidate names resolve to place ids via the free IDs-only search, so
// only the per-candidate details fetches draw from this bucket.
export const PLACES_PLACE_DETAILS_ENTERPRISE_MONTHLY_LIMIT = 800;

// Per-user daily soft cap so one user cannot drain the shared monthly budget.
// Counted across all Places SKUs combined, not per SKU.
export const PLACES_PER_USER_DAILY_LIMIT = 200;
