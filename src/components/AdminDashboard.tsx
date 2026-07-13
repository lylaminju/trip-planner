"use client";

import { useEffect, useRef, useState } from "react";

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

  const maxCount = Math.max(...data.map((d) => d.count), limit);
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
              fill={isHovered ? "#14b8a6" : "#0f766e"}
              opacity={isHovered || isToday ? 1 : 0.55}
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
