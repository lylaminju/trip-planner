"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DailyCount, UserUsageStats } from "@/server/supabase-admin-usage-store";

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

  const loadStats = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/usage", { cache: "no-store" })
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

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-toolbar">
        <button
          type="button"
          className="admin-refresh-button"
          onClick={loadStats}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

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

const CHART_WIDTH = 280;
const CHART_BAR_AREA_HEIGHT = 64;
const CHART_LABEL_HEIGHT = 16;
const CHART_HEIGHT = CHART_BAR_AREA_HEIGHT + CHART_LABEL_HEIGHT;
const BAR_GAP = 2;
// Headroom above the tallest bar so it never touches the top edge.
const CHART_AXIS_HEADROOM = 1.15;
// Only pin the axis to the daily limit (and draw the limit line) once usage
// climbs within this fraction of it; below that, fit the axis to the data.
const CHART_LIMIT_PROXIMITY = 0.6;

// Round up to a readable axis maximum (…, 5, 10, 25, 50, 100, …).
function niceCeil(value: number): number {
  if (value <= 5) return 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

type Tooltip = { left: number; top: number; text: string };

function UsageChart({ data, limit }: { data: DailyCount[]; limit: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) return null;

  const showTooltip = (event: React.MouseEvent, d: DailyCount, index: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setHoveredIndex(index);
    setTooltip({
      left: event.clientX - rect.left,
      top: event.clientY - rect.top,
      text: `${d.date}: ${d.count}`,
    });
  };

  const hideTooltip = () => {
    setHoveredIndex(null);
    setTooltip(null);
  };

  const dataMax = Math.max(...data.map((d) => d.count), 1);
  const nearLimit = dataMax >= limit * CHART_LIMIT_PROXIMITY;
  // Fit the axis to the data on normal days; expand to the limit only when
  // usage approaches it, so the limit line stays meaningful without flattening
  // the bars the rest of the time.
  const maxCount = nearLimit ? limit : niceCeil(dataMax * CHART_AXIS_HEADROOM);
  const barCount = data.length;
  const barWidth = (CHART_WIDTH - BAR_GAP * (barCount - 1)) / barCount;
  const today = new Date().toISOString().slice(0, 10);
  const limitY = CHART_BAR_AREA_HEIGHT - (limit / maxCount) * CHART_BAR_AREA_HEIGHT;

  return (
    <div className="admin-usage-chart-wrap" ref={wrapRef}>
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="admin-usage-chart"
      aria-hidden="true"
    >
      {/* Limit line — only shown once usage nears the cap, otherwise it would
          sit off the top of a data-fitted axis and carry no information. */}
      {nearLimit && (
        <line
          x1={0}
          y1={limitY}
          x2={CHART_WIDTH}
          y2={limitY}
          stroke="var(--chart-limit-line)"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity="0.6"
        />
      )}

      {/* Axis scale hint: peak value on a data-fitted axis, or the cap when
          the axis is pinned to the limit. */}
      <text x={0} y={8} fontSize="8" fill="var(--text-soft)">
        {nearLimit ? `cap ${limit}` : `peak ${dataMax}`}
      </text>

      {data.map((d, i) => {
        const x = i * (barWidth + BAR_GAP);
        const barH = maxCount > 0 ? (d.count / maxCount) * CHART_BAR_AREA_HEIGHT : 0;
        const y = CHART_BAR_AREA_HEIGHT - barH;
        const isToday = d.date === today;
        const isHovered = i === hoveredIndex;
        const showLabel = i === 0 || i === data.length - 1 || i % 4 === 0;
        const labelDate = d.date.slice(5).replace("-", "/");

        return (
          <g key={d.date}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              fill={isHovered ? "var(--chart-bar-hover)" : "var(--accent)"}
              opacity={isHovered || isToday ? 1 : 0.55}
              rx={1.5}
            />
            {showLabel && (
              <text
                x={x + barWidth / 2}
                y={CHART_HEIGHT - 2}
                textAnchor="middle"
                fontSize="8"
                fill="var(--text-secondary)"
              >
                {labelDate}
              </text>
            )}
            {/* Full-height transparent hover target so the exact count shows
                anywhere over the column, not just on the drawn bar. */}
            <rect
              x={x}
              y={0}
              width={barWidth}
              height={CHART_BAR_AREA_HEIGHT}
              fill="transparent"
              onMouseEnter={(e) => showTooltip(e, d, i)}
              onMouseMove={(e) => showTooltip(e, d, i)}
              onMouseLeave={hideTooltip}
            />
          </g>
        );
      })}
    </svg>
      {tooltip && (
        <div
          className="admin-usage-tooltip"
          style={{ left: tooltip.left, top: tooltip.top }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
