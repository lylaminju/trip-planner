"use client";

import { useRef, useState } from "react";

import type { DailyCount } from "@/lib/daily-counts";

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

// `limit` is optional: uncapped series (e.g. guest activity events) always get
// a data-fitted axis and never show a limit line.
export function UsageChart({ data, limit }: { data: DailyCount[]; limit?: number }) {
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
  // Fit the axis to the data on normal days; expand to the limit only when
  // usage approaches it, so the limit line stays meaningful without flattening
  // the bars the rest of the time.
  const pinnedLimit =
    limit !== undefined && dataMax >= limit * CHART_LIMIT_PROXIMITY ? limit : null;
  const maxCount = pinnedLimit ?? niceCeil(dataMax * CHART_AXIS_HEADROOM);
  const barCount = data.length;
  const barWidth = (CHART_WIDTH - BAR_GAP * (barCount - 1)) / barCount;
  const today = new Date().toISOString().slice(0, 10);
  const limitY =
    pinnedLimit !== null
      ? CHART_BAR_AREA_HEIGHT - (pinnedLimit / maxCount) * CHART_BAR_AREA_HEIGHT
      : 0;

  return (
    <div className="admin-usage-chart-wrap" ref={wrapRef}>
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="admin-usage-chart"
      aria-hidden="true"
    >
      {/* Limit line — only shown once usage nears the cap, otherwise it would
          sit off the top of a data-fitted axis and carry no information. */}
      {pinnedLimit !== null && (
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
        {pinnedLimit !== null ? `cap ${pinnedLimit}` : `peak ${dataMax}`}
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
