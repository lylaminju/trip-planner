"use client";

import { useCallback, useEffect, useState } from "react";

import type { UserUsageStats } from "@/server/supabase-admin-usage-store";

import { GuestActivitySection } from "./admin-dashboard/GuestActivitySection";
import { UsageChart } from "./admin-dashboard/UsageChart";

const GOOGLE_ROUTES_CHART_LIMIT = 200;
// Mirrors PLACES_PER_USER_DAILY_LIMIT (the per-user daily cap in the places
// usage store, enforced across both SKUs combined); kept as a local literal so
// this client file avoids importing the server-only store module.
const GOOGLE_PLACES_CHART_LIMIT = 200;
const AI_GENERATIONS_CHART_LIMIT = 30;

// Render the last sign-in timestamp in the viewer's local timezone, including
// the timezone name (e.g. "Jul 13, 2026, 2:30 PM PDT").
function formatLastSignIn(lastSignInAt: string | null): string {
  if (!lastSignInAt) return "Last login: never";
  return `Last login: ${new Date(lastSignInAt).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })}`;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<UserUsageStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Incremented on Refresh so GuestActivitySection refetches alongside the
  // per-user stats.
  const [refreshToken, setRefreshToken] = useState(0);

  const loadStats = useCallback(() => {
    setLoading(true);
    setError(null);
    // Charts bucket by calendar days in the viewer's timezone.
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/admin/usage?tz=${encodeURIComponent(timeZone)}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<UserUsageStats[]>;
      })
      .then(setStats)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load usage stats.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const refresh = () => {
    setRefreshToken((token) => token + 1);
    loadStats();
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-toolbar">
        <button
          type="button"
          className="admin-refresh-button"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <GuestActivitySection refreshToken={refreshToken} />

      {error && <p className="error-text">{error}</p>}
      {!stats && !error && <p className="trip-empty-text">Loading usage stats...</p>}
      {stats && stats.length === 0 && <p className="trip-empty-text">No usage data yet.</p>}

      {stats?.map((user) => (
        <div key={user.userId} className="admin-user-card">
          <div className="admin-user-header">
            <p className="admin-user-email">{user.email}</p>
            <p className="admin-user-last-login">{formatLastSignIn(user.lastSignInAt)}</p>
          </div>
          <div className="admin-charts-row">
            <div className="admin-chart-block">
              <p className="admin-chart-label">
                Google Routes <span>/ {GOOGLE_ROUTES_CHART_LIMIT} per day</span>
              </p>
              <UsageChart data={user.googleRoutesByDay} limit={GOOGLE_ROUTES_CHART_LIMIT} />
            </div>
            <div className="admin-chart-block">
              <p className="admin-chart-label">
                Places Autocomplete <span>/ {GOOGLE_PLACES_CHART_LIMIT} per day</span>
              </p>
              <UsageChart data={user.placesAutocompleteByDay} limit={GOOGLE_PLACES_CHART_LIMIT} />
            </div>
            <div className="admin-chart-block">
              <p className="admin-chart-label">
                Places Details <span>/ {GOOGLE_PLACES_CHART_LIMIT} per day</span>
              </p>
              <UsageChart data={user.placesDetailsByDay} limit={GOOGLE_PLACES_CHART_LIMIT} />
            </div>
            <div className="admin-chart-block">
              <p className="admin-chart-label">
                AI Generations <span>/ {AI_GENERATIONS_CHART_LIMIT} per day</span>
              </p>
              <UsageChart data={user.aiGenerationsByDay} limit={AI_GENERATIONS_CHART_LIMIT} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
