"use client";

import { useState } from "react";
import type { WeeklyVolume } from "@/types/api";
import { CHART, MARK } from "./chart-tokens";

const WIDTH = 420;
const HEIGHT = 200;
const PADDING = { top: 24, right: 12, bottom: 28, left: 32 };

/**
 * Stacked columns: replied (accent) over pending (gray).
 *
 * Emphasis rather than two competing hues — "replied" is the number the
 * report is about, "pending" is context. Only the column total is direct-
 * labelled; per-segment values live in the tooltip, since an interior
 * stacked segment has no free end to label without clipping.
 */
export function WeeklyVolumeChart({ data }: { data: WeeklyVolume[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const maxTotal = Math.max(1, ...data.map((week) => week.replied + week.pending));
  const bandWidth = plotWidth / Math.max(1, data.length);
  const barWidth = Math.min(MARK.maxBarWidth, bandWidth * 0.5);

  const toY = (value: number) => PADDING.top + plotHeight - (value / maxTotal) * plotHeight;
  const ticks = buildTicks(maxTotal);

  return (
    <figure className="m-0">
      <figcaption className="mb-1 text-sm font-medium text-gray-900">Reviews replied per week</figcaption>
      <p className="mb-3 text-xs text-gray-500">Posted replies vs still awaiting approval</p>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Reviews replied per week">
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={toY(tick)}
              y2={toY(tick)}
              stroke={CHART.gridline}
              strokeWidth={1}
            />
            <text x={PADDING.left - 8} y={toY(tick) + 4} textAnchor="end" fontSize={10} fill={CHART.textMuted}>
              {tick}
            </text>
          </g>
        ))}

        {data.map((week, index) => {
          const total = week.replied + week.pending;
          const centerX = PADDING.left + bandWidth * index + bandWidth / 2;
          const x = centerX - barWidth / 2;
          const baseline = toY(0);

          // Pending sits on the baseline; replied stacks above it, separated
          // by a surface-coloured gap rather than a stroke.
          const pendingHeight = (week.pending / maxTotal) * plotHeight;
          const repliedHeight = (week.replied / maxTotal) * plotHeight;
          const pendingY = baseline - pendingHeight;
          const repliedY = pendingY - repliedHeight - (week.pending > 0 ? MARK.surfaceGap : 0);

          return (
            <g
              key={week.week}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Hit target spans the whole band, so hover is easy. */}
              <rect x={PADDING.left + bandWidth * index} y={PADDING.top} width={bandWidth} height={plotHeight} fill="transparent" />

              {week.pending > 0 && (
                <path
                  d={roundedTopRect(x, pendingY, barWidth, pendingHeight, week.replied > 0 ? 0 : MARK.barRadius)}
                  fill={CHART.deemphasis}
                />
              )}
              {week.replied > 0 && (
                <path
                  d={roundedTopRect(x, repliedY, barWidth, repliedHeight, MARK.barRadius)}
                  fill={CHART.accent}
                />
              )}

              <text x={centerX} y={Math.min(repliedY, pendingY) - 6} textAnchor="middle" fontSize={11} fill={CHART.textPrimary}>
                {total > 0 ? total : ""}
              </text>
              <text x={centerX} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill={CHART.textMuted}>
                {week.week}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered !== null && data[hovered] && (
        <p className="mt-1 text-xs text-gray-600">
          <strong>{data[hovered].week}</strong> — {data[hovered].replied} replied, {data[hovered].pending} pending
        </p>
      )}

      <Legend />
    </figure>
  );
}

function Legend() {
  return (
    <ul className="mt-2 flex list-none gap-4 p-0 text-xs text-gray-600">
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: CHART.accent }} />
        Replied
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: CHART.deemphasis }} />
        Pending approval
      </li>
    </ul>
  );
}

/** Rect with rounded top corners and a square baseline, per the mark spec. */
function roundedTopRect(x: number, y: number, width: number, height: number, radius: number): string {
  if (height <= 0) return "";
  const r = Math.min(radius, height, width / 2);
  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${y + height}`,
    "Z",
  ].join(" ");
}

/** Clean round tick values rather than raw fractions of the max. */
function buildTicks(maxValue: number): number[] {
  const step = Math.max(1, Math.ceil(maxValue / 4));
  const ticks: number[] = [];
  for (let value = 0; value <= maxValue; value += step) {
    ticks.push(value);
  }
  return ticks;
}
