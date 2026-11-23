"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, downloadFile } from "@/lib/api-client";
import type { PeriodReport, ReportBucket, ReportPeriod } from "@/types/api";
import { CHART, MARK } from "./chart-tokens";

const PERIODS: { value: ReportPeriod; label: string; noun: string; previous: string }[] = [
  { value: "week", label: "Weekly", noun: "week", previous: "last week" },
  { value: "month", label: "Monthly", noun: "month", previous: "last month" },
  { value: "year", label: "Yearly", noun: "year", previous: "last year" },
];

/** 5★ to 1★. Green to red, so a quick look shows whether a period leaned good or bad. */
const STAR_COLOURS = ["#188038", "#81c995", "#fbbc04", "#f29900", "#d93025"] as const;

const WIDTH = 560;
const HEIGHT = 200;
const PADDING = { top: 26, right: 12, bottom: 38, left: 32 };

/** Weekly, monthly or yearly view of the Google reviews, with a CSV download. */
export function PeriodReportSection({ locationId }: { locationId: string }) {
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [hideEmpty, setHideEmpty] = useState(true);
  const [report, setReport] = useState<PeriodReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const query = `period=${period}${locationId ? `&locationId=${encodeURIComponent(locationId)}` : ""}`;

  const load = useCallback(async () => {
    setError(null);
    try {
      setReport(await apiFetch<PeriodReport>(`/reports/period?${query}`));
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Could not load the report");
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function download() {
    setError(null);
    setDownloading(true);
    try {
      await downloadFile(`/reports/period.csv?${query}`, `review-report-${period}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the report");
    } finally {
      setDownloading(false);
    }
  }

  const meta = PERIODS.find((p) => p.value === period)!;

  return (
    <section className="rounded-xl border border-line bg-white shadow-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <div className="mr-auto">
          <h2 className="font-semibold text-ink">Reviews over time</h2>
          <p className="text-xs text-muted">New Google reviews for each {meta.noun}</p>
        </div>
        <div role="tablist" aria-label="Report period" className="flex overflow-hidden rounded-lg border border-line text-sm">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              role="tab"
              aria-selected={period === p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3.5 py-1.5 transition ${
                period === p.value ? "bg-brand-navy font-medium text-white" : "bg-white text-ink hover:bg-surface"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={download}
          disabled={downloading}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface disabled:opacity-50"
        >
          {downloading ? "Preparing…" : "⬇ Download CSV"}
        </button>
      </header>

      <div className="space-y-5 p-4">
        {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!report && !error && <p className="py-10 text-center text-sm text-muted">Loading the report…</p>}

        {report && (
          <>
            <Summary report={report} periodLabel={meta.noun} previousLabel={meta.previous} />
            <PeriodChart report={report} />
            <PeriodTable report={report} hideEmpty={hideEmpty} onHideEmpty={setHideEmpty} />
            {report.byLocation.length > 1 && <LocationSplit report={report} noun={meta.noun} />}
          </>
        )}
      </div>
    </section>
  );
}

/** The running period at a glance, against the one before it. */
function Summary({ report, periodLabel, previousLabel }: { report: PeriodReport; periodLabel: string; previousLabel: string }) {
  const current = report.buckets.at(-1)!;
  const before = report.buckets.at(-2);
  const totalDelta = before ? current.total - before.total : null;
  const ratingDelta =
    before && current.averageRating !== null && before.averageRating !== null
      ? Math.round((current.averageRating - before.averageRating) * 10) / 10
      : null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryTile label={`This ${periodLabel}`} value={String(current.total)} sub="new reviews" delta={totalDelta} unit="" compare={previousLabel} />
      <SummaryTile
        label="Average rating"
        value={current.averageRating !== null ? `${current.averageRating} ★` : "–"}
        sub={current.total ? `from ${current.total} ${current.total === 1 ? "review" : "reviews"}` : "no reviews yet"}
        delta={ratingDelta}
        unit=" ★"
        compare={previousLabel}
      />
      <SummaryTile
        label="Replied"
        value={`${current.replied}`}
        sub={current.total ? `of ${current.total}` : "nothing to reply to"}
        delta={null}
        unit=""
        compare={previousLabel}
      />
      <SummaryTile
        label="Response rate"
        value={current.responseRate !== null ? `${current.responseRate}%` : "–"}
        sub="of reviews since go-live"
        delta={null}
        unit=""
        compare={previousLabel}
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  sub,
  delta,
  unit,
  compare,
}: {
  label: string;
  value: string;
  sub: string;
  delta: number | null;
  unit: string;
  compare: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface/60 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      <p className="text-xs text-muted">{sub}</p>
      {delta !== null && (
        <p className={`mt-1 text-xs font-medium ${delta > 0 ? "text-green-700" : delta < 0 ? "text-red-600" : "text-muted"}`}>
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "–"} {delta > 0 ? "+" : ""}
          {delta}
          {unit} vs {compare}
        </p>
      )}
    </div>
  );
}

function PeriodChart({ report }: { report: PeriodReport }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const data = report.buckets;
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const max = Math.max(1, ...data.map((b) => b.total));
  const band = plotWidth / data.length;
  const barWidth = Math.min(MARK.maxBarWidth + 8, band * 0.55);
  const toY = (value: number) => PADDING.top + plotHeight - (value / max) * plotHeight;
  const step = Math.max(1, Math.ceil(max / 4));
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  const active = hovered !== null ? data[hovered] : null;

  return (
    <figure className="m-0 rounded-lg border border-line p-3">
      <figcaption className="mb-2 flex min-h-[20px] items-center justify-between gap-2 text-xs">
        <span className="font-medium text-ink">New reviews</span>
        <span className="text-muted">
          {active
            ? `${active.label}: ${active.total} ${active.total === 1 ? "review" : "reviews"}${active.averageRating !== null ? ` · ${active.averageRating} ★ average` : ""}`
            : "Hover a bar for details. The shaded column marked Now is the period still running."}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="New Google reviews per period">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={toY(tick)} y2={toY(tick)} stroke={CHART.gridline} />
            <text x={PADDING.left - 8} y={toY(tick) + 4} textAnchor="end" fontSize={10} fill={CHART.textMuted}>
              {tick}
            </text>
          </g>
        ))}
        {data.map((bucket, index) => {
          const centerX = PADDING.left + band * index + band / 2;
          const height = (bucket.total / max) * plotHeight;
          const isCurrent = index === data.length - 1;
          const isHover = hovered === index;
          return (
            <g key={bucket.start} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}>
              {/* The running period is always shaded, even when it has no reviews yet. */}
              <rect
                x={PADDING.left + band * index}
                y={PADDING.top}
                width={band}
                height={plotHeight}
                fill={isCurrent ? CHART.accentTrack : isHover ? "#0000000d" : "transparent"}
                opacity={isCurrent ? 0.55 : 1}
              />
              {bucket.total > 0 && (
                <rect
                  x={centerX - barWidth / 2}
                  y={toY(bucket.total)}
                  width={barWidth}
                  height={height}
                  rx={MARK.barRadius}
                  fill={isCurrent ? CHART.accent : isHover ? "#125383" : "#46506a"}
                />
              )}
              {bucket.total === 0 && (
                // A zero is still a result: a short stub on the baseline instead of nothing.
                <rect x={centerX - barWidth / 2} y={toY(0) - 2} width={barWidth} height={2} rx={1} fill={isCurrent ? CHART.accent : "#c5c9d3"} />
              )}
              <text x={centerX} y={toY(bucket.total) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={CHART.textPrimary}>
                {bucket.total > 0 ? bucket.total : isCurrent ? "0" : ""}
              </text>
              <text x={centerX} y={HEIGHT - 18} textAnchor="middle" fontSize={9} fill={isCurrent ? CHART.accent : CHART.textMuted} fontWeight={isCurrent ? 600 : 400}>
                {shortLabel(bucket.label)}
              </text>
              {isCurrent && (
                <text x={centerX} y={HEIGHT - 1} textAnchor="middle" fontSize={8} fontWeight={700} letterSpacing={0.5} fill={CHART.accent}>
                  NOW
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** "Oct 2026" is too wide for twelve columns; "Oct '26" fits. */
function shortLabel(label: string): string {
  return label.replace(/ 20(\d\d)$/, " '$1");
}

function PeriodTable({ report, hideEmpty, onHideEmpty }: { report: PeriodReport; hideEmpty: boolean; onHideEmpty: (v: boolean) => void }) {
  const lastIndex = report.buckets.length - 1;
  // Newest first: that is the row people look for. The running period always stays.
  const rows = useMemo(
    () =>
      report.buckets
        .map((bucket, index) => ({ bucket, isCurrent: index === lastIndex }))
        .filter((r) => !hideEmpty || r.bucket.total > 0 || r.isCurrent)
        .reverse(),
    [report.buckets, hideEmpty, lastIndex],
  );
  const hiddenCount = report.buckets.length - rows.length;

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface/60 px-3 py-2">
        <h3 className="text-sm font-medium text-ink">Details by period</h3>
        <div className="flex flex-wrap items-center gap-4">
          <StarLegend />
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" className="accent-brand-pink" checked={hideEmpty} onChange={(e) => onHideEmpty(e.target.checked)} />
            Hide empty periods{hideEmpty && hiddenCount > 0 ? ` (${hiddenCount})` : ""}
          </label>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-white text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">Period</th>
              <th className="px-3 py-2 text-right font-medium">Reviews</th>
              <th className="px-3 py-2 font-medium">Average</th>
              <th className="px-3 py-2 font-medium">Star mix</th>
              <th className="px-3 py-2 text-right font-medium">Replied</th>
              <th className="px-3 py-2 font-medium">Response rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ bucket: b, isCurrent }) => (
              <tr key={b.start} className={`border-b border-gray-100 last:border-0 ${isCurrent ? "bg-brand-pink/5" : "hover:bg-surface/60"}`}>
                <td className="px-3 py-2.5 font-medium text-ink">
                  {b.label}
                  {isCurrent && <span className="ml-2 rounded-full bg-brand-pink/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-pink">Now</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink">{b.total}</td>
                <td className="px-3 py-2.5 tabular-nums text-ink">{b.averageRating !== null ? <Rating value={b.averageRating} /> : <Dash />}</td>
                <td className="w-48 px-3 py-2.5">{b.total > 0 ? <StarMix bucket={b} /> : <Dash />}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink">{b.total > 0 ? b.replied : <Dash />}</td>
                <td className="w-40 px-3 py-2.5">{b.responseRate !== null ? <RateBar value={b.responseRate} /> : <Dash />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const Dash = () => <span className="text-gray-300">–</span>;

function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium">
      <span className="text-amber-500">★</span>
      {value.toFixed(1)}
    </span>
  );
}

/** One stacked bar per period: how many 5★ to 1★. The title gives exact counts. */
function StarMix({ bucket }: { bucket: ReportBucket }) {
  const counts = [...bucket.ratingMix].reverse(); // 5★ first
  const title = counts.map((c, i) => `${5 - i}★: ${c}`).join("   ");
  return (
    <div title={title} aria-label={title} className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
      {counts.map((count, i) =>
        count > 0 ? (
          <span key={i} style={{ width: `${(count / bucket.total) * 100}%`, background: STAR_COLOURS[i] }} />
        ) : null,
      )}
    </div>
  );
}

function RateBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-brand-pink" style={{ width: `${value}%` }} />
      </div>
      <span className="w-9 text-xs tabular-nums text-ink">{value}%</span>
    </div>
  );
}

function StarLegend() {
  return (
    <ul className="m-0 flex list-none items-center gap-2.5 p-0 text-[11px] text-muted">
      {STAR_COLOURS.map((colour, i) => (
        <li key={colour} className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: colour }} />
          {5 - i}★
        </li>
      ))}
    </ul>
  );
}

function LocationSplit({ report, noun }: { report: PeriodReport; noun: string }) {
  const max = Math.max(1, ...report.byLocation.map((l) => l.total));
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="border-b border-line bg-surface/60 px-3 py-2">
        <h3 className="text-sm font-medium text-ink">This {noun} by location</h3>
      </div>
      <ul className="m-0 list-none divide-y divide-gray-100 p-0">
        {report.byLocation.map((l) => (
          <li key={l.locationId} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface/60">
            <span className="min-w-0 flex-1 truncate font-medium text-ink">{l.name}</span>
            <div className="hidden h-2 w-32 overflow-hidden rounded-full bg-gray-100 sm:block">
              <div className="h-full rounded-full bg-brand-pink" style={{ width: `${(l.total / max) * 100}%` }} />
            </div>
            <span className="w-24 shrink-0 text-right tabular-nums text-ink">
              {l.total} {l.total === 1 ? "review" : "reviews"}
            </span>
            <span className="w-14 shrink-0 text-right">{l.averageRating !== null ? <Rating value={l.averageRating} /> : <Dash />}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
