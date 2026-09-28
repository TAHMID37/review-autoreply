"use client";

import { CHART } from "./chart-tokens";

const SIZE = 160;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A meter, not a two-slice pie.
 *
 * Response rate is a single ratio against a limit (100%), so the correct form
 * is a meter with a same-ramp track: the filled arc in the accent hue, the
 * remainder in a light step of that same hue. Treating "not yet replied" as a
 * second category would give a rounding remainder its own identity colour and
 * imply the two are peers, which they are not.
 */
export function ResponseRateMeter({
  responseRate,
  replied,
  pending,
}: {
  responseRate: number;
  replied: number;
  pending: number;
}) {
  const filled = Math.max(0, Math.min(100, responseRate));

  return (
    <figure className="m-0">
      <figcaption className="mb-1 text-sm font-medium text-gray-900">Response rate</figcaption>
      <p className="mb-3 text-xs text-gray-500">Of all reviews received</p>

      <div className="flex items-center gap-6">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-40 w-40 flex-shrink-0"
          role="img"
          aria-label={`${filled}% of reviews have a reply posted`}
        >
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke={CHART.accentTrack} strokeWidth={STROKE} />
          {/* Omitted entirely at 0%: a round linecap still paints a dot at
              zero length, which would read as a small non-zero value. */}
          {filled > 0 && (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={CHART.accent}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${(filled / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          )}
          <text
            x={SIZE / 2}
            y={SIZE / 2 + 2}
            textAnchor="middle"
            fontSize={30}
            fontWeight={600}
            fill={CHART.textPrimary}
          >
            {filled}%
          </text>
          <text x={SIZE / 2} y={SIZE / 2 + 22} textAnchor="middle" fontSize={11} fill={CHART.textMuted}>
            replied
          </text>
        </svg>

        <dl className="m-0 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: CHART.accent }} />
            <dt className="text-gray-600">Replied</dt>
            <dd className="m-0 font-medium text-gray-900">{replied}</dd>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: CHART.accentTrack }} />
            <dt className="text-gray-600">Awaiting reply</dt>
            <dd className="m-0 font-medium text-gray-900">{pending}</dd>
          </div>
        </dl>
      </div>
    </figure>
  );
}
