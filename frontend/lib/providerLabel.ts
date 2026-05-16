/**
 * Display labels for the four canonical provider names used across
 * canonical_offers.provider. Keep this list in sync with the collectors
 * registered in backend/basis/collectors/__init__.py.
 *
 * Unknown providers (a future collector that lands before this map is
 * updated) are surfaced as their canonical key, so the chart still
 * draws a column rather than collapsing it.
 */
export const PROVIDER_LABELS: Record<string, string> = {
  vast: "Vast.ai",
  runpod: "RunPod",
  aws_spot: "AWS Spot",
  tensordock: "TensorDock",
};

export function providerLabel(canonical: string): string {
  return PROVIDER_LABELS[canonical] ?? canonical;
}
