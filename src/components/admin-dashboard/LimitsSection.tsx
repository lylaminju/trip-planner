import {
  AI_GENERATION_DAILY_LIMIT,
  GOOGLE_ROUTES_DAILY_LIMIT,
  GUEST_AI_GENERATION_DAILY_LIMIT,
  GUEST_AI_GENERATION_GLOBAL_DAILY_CAP,
  GUEST_GOOGLE_ROUTES_DAILY_LIMIT,
  GUEST_GOOGLE_ROUTES_GLOBAL_DAILY_CAP,
  PLACES_AUTOCOMPLETE_MONTHLY_LIMIT,
  PLACES_DETAILS_MONTHLY_LIMIT,
  PLACES_PLACE_DETAILS_ENTERPRISE_MONTHLY_LIMIT,
  PLACES_PER_USER_DAILY_LIMIT,
  PLACES_PHOTO_MONTHLY_LIMIT,
} from "@/lib/api-limits";

// Fixed locale so the server-rendered markup matches the client's; the admin
// UI is English-only, and a locale-dependent separator would hydrate mismatched.
const LIMIT_NUMBER_FORMAT = new Intl.NumberFormat("en-US");

type LimitGroup = {
  title: string;
  scope: string;
  limits: { label: string; value: number }[];
};

// Reads straight from the enforced constants, so the panel cannot drift from
// what the quota gates actually apply.
const LIMIT_GROUPS: LimitGroup[] = [
  {
    title: "Signed-in user",
    scope: "per day, per account",
    limits: [
      { label: "AI generations", value: AI_GENERATION_DAILY_LIMIT },
      { label: "Google Routes", value: GOOGLE_ROUTES_DAILY_LIMIT },
      { label: "Google Places, all SKUs", value: PLACES_PER_USER_DAILY_LIMIT },
    ],
  },
  {
    title: "Guest session",
    scope: "per day, per browser",
    limits: [
      { label: "AI generations", value: GUEST_AI_GENERATION_DAILY_LIMIT },
      { label: "Google Routes", value: GUEST_GOOGLE_ROUTES_DAILY_LIMIT },
    ],
  },
  {
    title: "All guests combined",
    scope: "per day, demo-wide",
    limits: [
      { label: "AI generations", value: GUEST_AI_GENERATION_GLOBAL_DAILY_CAP },
      { label: "Google Routes", value: GUEST_GOOGLE_ROUTES_GLOBAL_DAILY_CAP },
    ],
  },
  {
    title: "Google Places free tier",
    scope: "per month, account-wide",
    limits: [
      { label: "Autocomplete", value: PLACES_AUTOCOMPLETE_MONTHLY_LIMIT },
      { label: "Place Details", value: PLACES_DETAILS_MONTHLY_LIMIT },
      { label: "Place Photo", value: PLACES_PHOTO_MONTHLY_LIMIT },
      { label: "Place details (Enterprise)", value: PLACES_PLACE_DETAILS_ENTERPRISE_MONTHLY_LIMIT },
    ],
  },
];

// The enforced ceilings behind every chart below. Static: these come from the
// source constants, not from the usage tables, so there is nothing to refresh.
export function LimitsSection() {
  return (
    <div className="admin-limits-card">
      <div className="admin-user-header">
        <p className="admin-limits-title">Rate limits</p>
        <p className="admin-limits-subtitle">Enforced ceilings</p>
      </div>

      <div className="admin-limits-groups">
        {LIMIT_GROUPS.map((group) => (
          <div key={group.title} className="admin-limits-group">
            <p className="admin-limits-group-title">
              {group.title} <span>{group.scope}</span>
            </p>
            <dl className="admin-limits-list">
              {group.limits.map((limit) => (
                <div key={limit.label} className="admin-limits-row">
                  <dt className="admin-limits-label">{limit.label}</dt>
                  <dd className="admin-limits-value">
                    {LIMIT_NUMBER_FORMAT.format(limit.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
