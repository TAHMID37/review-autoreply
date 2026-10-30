/**
 * Chart palette. Validated with the dataviz validator against the light
 * surface - do not substitute by eye:
 *
 *   accent vs deemphasis: CVD ΔE 8.5 (deutan), normal-vision ΔE 22.6,
 *   both ≥ 3:1 contrast on surface.
 *
 * `deemphasis` is intentionally a gray: this is the emphasis pattern, where
 * "replied" is the story and "pending" is context. It is not a categorical
 * identity slot, so the chroma floor does not apply to it.
 */
export const CHART = {
  accent: "#DD1157", // brand magenta accent
  /** Light step of the accent hue - the meter's same-ramp track. */
  accentTrack: "#F8CEDC",
  deemphasis: "#6b7280",
  gridline: "#e5e7eb",
  textPrimary: "#111827",
  textMuted: "#6b7280",
  surface: "#ffffff",
} as const;

/** Fixed mark specs (see dataviz marks-and-anatomy). */
export const MARK = {
  maxBarWidth: 24,
  barRadius: 4,
  /** Surface-coloured gap separating touching stacked segments. */
  surfaceGap: 2,
} as const;
