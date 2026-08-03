/**
 * Era annotations for residual time series (design doc §7).
 *
 * Every residual series on the site carries the same two markers so a reader
 * comparing two charts is comparing the same timeline. Copy is truth-patch
 * sourced; the dates are corpus facts, not editorial choices, which is why
 * they live in one place rather than being retyped per chart.
 */

export interface EraAnnotation {
  /** ISO date the event lands on. */
  date: string;
  /** One-character rule label drawn on the chart. */
  marker: string;
  /** Legend copy. */
  label: string;
}

export const ERA_ANNOTATIONS: EraAnnotation[] = [
  {
    date: "2026-07-26",
    marker: "D",
    label: "Era D — Vast spot becomes visible",
  },
  {
    date: "2026-07-28",
    marker: "C",
    label: "Azure/GCP list catalogs join",
  },
];

/**
 * Index of the first point at or after an annotation's date, or null when the
 * event falls outside the rendered window. Series are sorted ascending by the
 * API, so a linear scan is both correct and cheap at these lengths.
 */
export function annotationIndex(
  dates: string[],
  annotation: EraAnnotation
): number | null {
  if (dates.length === 0) return null;
  if (annotation.date < dates[0]) return null;
  if (annotation.date > dates[dates.length - 1]) return null;
  const idx = dates.findIndex((date) => date >= annotation.date);
  return idx === -1 ? null : idx;
}
