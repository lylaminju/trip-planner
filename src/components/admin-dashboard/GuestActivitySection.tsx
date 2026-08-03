"use client";

import { useEffect, useState } from "react";

import type { GuestEventName } from "@/server/guest-events";
import type { GuestActivityStats } from "@/server/supabase-admin-guest-activity-store";

import { UsageChart } from "./UsageChart";

// Mirrors GUEST_AI_GENERATION_GLOBAL_DAILY_CAP (the demo-wide daily cap across
// all guests in the guest usage store); kept as a local literal so this client
// file avoids importing the server-only store module.
const GUEST_AI_GENERATIONS_CHART_CAP = 50;

// Charts render in the server's GUEST_EVENT_NAMES order; this map only
// supplies the admin-facing label (and cap, where one exists) per event.
const GUEST_EVENT_CHARTS: Record<GuestEventName, { label: string; limit?: number }> = {
  sample_cloned: { label: "Sample trips explored" },
  trip_created: { label: "Own trips planned" },
  place_added: { label: "Places added" },
  generation_run: { label: "AI generations", limit: GUEST_AI_GENERATIONS_CHART_CAP },
  limit_hit: { label: "Limits hit" },
  upsell_clicked: { label: "Upsells clicked" },
};

// Anonymous (not signed-in) visitors who used "explore a sample trip" or
// "plan your own trip" from the landing page. Refetches whenever refreshToken
// changes so the shared Refresh button reloads this section too.
export function GuestActivitySection({ refreshToken }: { refreshToken: number }) {
  const [stats, setStats] = useState<GuestActivityStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    // Charts bucket by calendar days in the viewer's timezone.
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/admin/guest-activity?tz=${encodeURIComponent(timeZone)}`, {
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<GuestActivityStats>;
      })
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load guest activity.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  return (
    <div className="admin-guest-card">
      <div className="admin-user-header">
        <p className="admin-guest-title">Guest activity</p>
        <p className="admin-guest-subtitle">Not signed in · last 14 days</p>
      </div>

      {error && <p className="error-text">{error}</p>}
      {!stats && !error && <p className="trip-empty-text">Loading guest activity...</p>}

      {stats && (
        <div className="admin-charts-row admin-guest-charts-row">
          <div className="admin-chart-block">
            <p className="admin-chart-label">
              Active guests <span>unique per day</span>
            </p>
            <UsageChart data={stats.activeGuestsByDay} />
          </div>
          {stats.eventCharts.map(({ eventName, byDay }) => {
            const { label, limit } = GUEST_EVENT_CHARTS[eventName];
            return (
              <div key={eventName} className="admin-chart-block">
                <p className="admin-chart-label">
                  {label}
                  {limit !== undefined && <span> / {limit} per day</span>}
                </p>
                <UsageChart data={byDay} limit={limit} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
