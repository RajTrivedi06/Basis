/**
 * CSS variable string for each factor in the variance decomposition.
 *
 * The residual keeps its own token — sacred, used nowhere else in the UI.
 * Factors are muted warm neutrals that stay subordinate to it. Matches the
 * tokens in globals.css.
 */
export type Factor =
  | "provider"
  | "commitment"
  | "region"
  | "bundle"
  | "residual";

const MAP: Record<Factor, string> = {
  provider: "var(--factor-provider)",
  commitment: "var(--factor-commitment)",
  region: "var(--factor-region)",
  bundle: "var(--factor-bundle)",
  residual: "var(--residual)",
};

export function factorColor(factor: Factor): string {
  return MAP[factor];
}
