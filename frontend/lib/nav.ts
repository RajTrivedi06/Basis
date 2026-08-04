/**
 * The site's ordered sections — one source of truth.
 *
 * The nav numbers (01–06) and the dossier pages' "SHEET 03 OF 06" stamps
 * both derive from this list. They used to be typed by hand in five
 * places, so adding or reordering a page silently made every stamp lie.
 */

export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/findings", label: "Findings" },
  { href: "/dispersion", label: "Dispersion" },
  { href: "/basis", label: "Basis" },
  { href: "/providers", label: "Providers" },
  { href: "/explainability", label: "Explainability" },
  { href: "/methodology", label: "Methodology" },
];

export const SECTION_COUNT = NAV_ITEMS.length;

/** Two-digit index of a section, positional: "03". */
export function sectionNumber(href: string): string {
  const i = NAV_ITEMS.findIndex((item) => item.href === href);
  return String((i === -1 ? 0 : i) + 1).padStart(2, "0");
}

/** Two-digit index by position, for rendering the nav itself. */
export function navNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/** The dossier stamp: "SHEET 03 OF 06". */
export function sheetLabel(href: string): string {
  return `SHEET ${sectionNumber(href)} OF ${String(SECTION_COUNT).padStart(2, "0")}`;
}
