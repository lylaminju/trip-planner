"use client";

import { useEffect, useState } from "react";

import type { DailyCount, UserUsageStats } from "@/server/supabase-admin-usage-store";

const GOOGLE_ROUTES_CHART_LIMIT = 200;
const AI_GENERATIONS_CHART_LIMIT = 30;

export function AdminDashboard() {
  const [stats, setStats] = useState<UserUsageStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/usage")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<UserUsageStats[]>;
      })
      .then(setStats)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load usage stats.");
      });
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!stats) return <p className="trip-empty-text">Loading usage stats...</p>;
  if (stats.length === 0) return <p className="trip-empty-text">No usage data yet.</p>;

  return (
    <div className="admin-dashboard">
      {stats.map((user) => (
        <div key={user.userId} className="admin-user-card">
          <p className="admin-user-email">{user.email}</p>
          <div className="admin-charts-row">
            <div className="admin-chart-block">
              <p className="admin-chart-label">
                Google Routes <span>/ {GOOGLE_ROUTES_CHART_LIMIT} per day</span>
              </p>
              <UsageChart data={user.googleRoutesByDay} limit={GOOGLE_ROUTES_CHART_LIMIT} />
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

const CHART_WIDTH = 280;
const CHART_BAR_AREA_HEIGHT = 64;
const CHART_LABEL_HEIGHT = 16;
const CHART_HEIGHT = CHART_BAR_AREA_HEIGHT + CHART_LABEL_HEIGHT;
const BAR_GAP = 2;

function UsageChart({ data, limit }: { data: DailyCount[]; limit: number }) {
  if (data.length === 0) return null;

  const maxCount = Math.max(...data.map((d) => d.count), limit);
  const barCount = data.length;
  const barWidth = (CHART_WIDTH - BAR_GAP * (barCount - 1)) / barCount;
  const today = new Date().toISOString().slice(0, 10);
  const limitY = CHART_BAR_AREA_HEIGHT - (limit / maxCount) * CHART_BAR_AREA_HEIGHT;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="admin-usage-chart"
      aria-hidden="true"
    >
      {/* Limit line */}
      <line
        x1={0}
        y1={limitY}
        x2={CHART_WIDTH}
        y2={limitY}
        stroke="#e53e3e"
        strokeWidth="1"
        strokeDasharray="4 3"
        opacity="0.6"
      />

      {data.map((d, i) => {
        const x = i * (barWidth + BAR_GAP);
        const barH = maxCount > 0 ? (d.count / maxCount) * CHART_BAR_AREA_HEIGHT : 0;
        const y = CHART_BAR_AREA_HEIGHT - barH;
        const isToday = d.date === today;
        const showLabel = i === 0 || i === data.length - 1 || i % 4 === 0;
        const labelDate = d.date.slice(5).replace("-", "/");

        return (
          <g key={d.date}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              fill="#0f766e"
              opacity={isToday ? 1 : 0.55}
              rx={1.5}
            />
            {showLabel && (
              <text
                x={x + barWidth / 2}
                y={CHART_HEIGHT - 2}
                textAnchor="middle"
                fontSize="8"
                fill="#64748b"
              >
                {labelDate}
              </text>
            )}
            {d.count > 0 && <title>{`${d.date}: ${d.count}`}</title>}
          </g>
        );
      })}
    </svg>
  );
}
