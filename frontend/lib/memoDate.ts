/**
 * Uppercase memo stamp from an ISO date/timestamp: "2026-08-02…" → "AUG 2".
 * Always derived from the artifact (A6) — never hardcoded.
 */
export function formatMemoDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  const mon = d
    .toLocaleString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();
  return `${mon} ${d.getUTCDate()}`;
}
