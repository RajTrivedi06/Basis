import { providerLabel } from "@/lib/providerLabel";
import type { Factor } from "@/lib/factorColor";
import type { DecompositionObservation } from "@/lib/types";

/**
 * Shaping contributing observations into per-offer points grouped by one
 * factor. The chart that draws them is BeeswarmReceipt; this module holds
 * only the grouping rules so they can be tested without a DOM.
 */

export type SwarmPoint = {
  canonicalOfferId: number;
  rawObservationId: number;
  price: number;
  groupKey: string;
  groupLabel: string;
  isUnknown: boolean;
  // Carried through for the receipt and the aria summary.
  provider: string;
  commitmentType: string;
  regionLabel: string;
};

/**
 * Build points for the given factor. Bundle quartiles are computed across
 * the input set, so the bins change with the dataset — this is intentional:
 * the view surfaces within-bin spread for the offers shown.
 */
export function pointsFromObservations(
  factor: Factor,
  observations: DecompositionObservation[]
): SwarmPoint[] {
  const common = (o: DecompositionObservation) => ({
    canonicalOfferId: o.canonical_offer_id,
    rawObservationId: o.raw_observation_id,
    price: o.price_usd_per_hour,
    provider: o.provider,
    commitmentType: o.commitment_type,
    regionLabel: regionLabelFor(o),
  });

  switch (factor) {
    case "region":
      return observations.map((o) => ({
        ...common(o),
        groupKey: o.region_country ?? "UNKNOWN",
        groupLabel: o.region_country ?? "UNKNOWN",
        isUnknown: o.region_country === null,
      }));

    case "commitment":
      return observations.map((o) => ({
        ...common(o),
        groupKey: o.commitment_type,
        groupLabel: o.commitment_type,
        isUnknown: false,
      }));

    case "provider":
      return observations.map((o) => ({
        ...common(o),
        groupKey: o.provider,
        groupLabel: providerLabel(o.provider),
        isUnknown: false,
      }));

    case "bundle": {
      const isAllNull = (o: DecompositionObservation) =>
        o.vcpus_bundled === null &&
        o.ram_gb_bundled === null &&
        o.storage_gb_bundled === null;

      const score = (o: DecompositionObservation) =>
        (o.vcpus_bundled ?? 0) * 1 +
        (o.ram_gb_bundled ?? 0) * 0.2 +
        (o.storage_gb_bundled ?? 0) * 0.001;

      const sized = observations
        .filter((o) => !isAllNull(o))
        .map(score)
        .sort((a, b) => a - b);

      const q1 = quantile(sized, 0.25);
      const q2 = quantile(sized, 0.5);
      const q3 = quantile(sized, 0.75);

      const bin = (s: number): string =>
        s < q1 ? "small" : s < q2 ? "medium" : s < q3 ? "large" : "x-large";

      return observations.map((o) => {
        const isUnknown = isAllNull(o);
        const key = isUnknown ? "UNKNOWN" : bin(score(o));
        return {
          ...common(o),
          groupKey: key,
          groupLabel: key,
          isUnknown,
        };
      });
    }

    case "residual":
      // Conditioning on (provider, commitment) — within-cell spread is the
      // residual.
      return observations.map((o) => ({
        ...common(o),
        groupKey: `${o.provider}|${o.commitment_type}`,
        groupLabel: `${providerLabel(o.provider)} · ${o.commitment_type}`,
        isUnknown: false,
      }));
  }
}

function regionLabelFor(o: DecompositionObservation): string {
  if (o.region_country === null) return "UNKNOWN";
  if (o.region_state) return `${o.region_country} · ${o.region_state}`;
  return o.region_country;
}

export function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return base + 1 < sorted.length
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}
