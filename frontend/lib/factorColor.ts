/**
 * CSS variable string for each factor in the variance decomposition.
 *
 * Residual is amber — sacred, used nowhere else in the UI. Factors are
 * muted slate descending from provider (lightest, most explanatory) to
 * bundle (darkest, least). Matches the tokens in globals.css.
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
