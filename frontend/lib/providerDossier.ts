/**
 * Editorial dossiers for the providers watch list.
 *
 * Live figures (offers, SKUs, Δ, last observed) always come from
 * GET /api/providers. This map only supplies the typed role clause and
 * observed-conduct note that sit beside those figures. Unknown keys fall
 * back so a new collector still renders a row without a deploy that
 * invents numbers.
 */

export type ProviderDossier = {
  /** Short stamped file id shown in the provenance column. */
  file: string;
  /** One-line market role under SUBJECT. */
  role: string;
  /** Observed-conduct paragraph revealed when the row opens. */
  dossier: string;
};

const DOSSIERS: Record<string, ProviderDossier> = {
  vast: {
    file: "BS-04-VAST",
    role: "marketplace · thousands of independent hosts",
    dossier:
      "Prices are set by many unrelated operators, so whatever the aggregate does is a marketplace outcome, not one seller's policy. Feature-rich listings; the only subject whose host identity can be traced day to day.",
  },
  runpod: {
    file: "BS-04-RUNP",
    role: "curated cloud · published catalog, operator-set",
    dossier:
      "A published price list, revised rarely — a single pricing authority quoting the same catalog twice a day, which is what a narrow spread looks like.",
  },
  aws_spot: {
    file: "BS-04-AWS",
    role: "hyperscaler spot · regional, contract-shaped",
    dossier:
      "Read any deviation as posture, not markup: this subject is concentrated in regions and bundle configurations the marketplace barely lists, and its commitment mix differs. Whether the same offer costs more is a question for the decomposition, not this sheet.",
  },
  azure: {
    file: "BS-04-AZUR",
    role: "hyperscaler catalog · fixed list prices",
    dossier:
      "A published list catalog rather than a market: prices move when the catalog is revised, not when demand does. Excluded from the market-priced series for exactly that reason.",
  },
  gcp: {
    file: "BS-04-GCP",
    role: "hyperscaler catalog · fixed list prices",
    dossier:
      "A published list catalog rather than a market: prices move when the catalog is revised, not when demand does. Excluded from the market-priced series for exactly that reason.",
  },
  tensordock: {
    file: "BS-04-TDCK",
    role: "marketplace · independent hosts",
    dossier:
      "Historical offers stay in the corpus and in the totals; when a subject is tagged, only the claim of live observation is withdrawn. A single successful collection reinstates it automatically.",
  },
};

/**
 * The deviation sentence is derived from the live figure, never written
 * down — prose that asserts a direction can contradict the number beside
 * it the moment the market moves (Quarantine Rule).
 */
export function deltaClause(pct: number | null): string {
  if (pct === null) {
    return "No comparable market median on the latest collection date, so no deviation is filed.";
  }
  if (Math.abs(pct) < 0.05) {
    return "Sits level with the market median on the latest collection date.";
  }
  const dir = pct > 0 ? "above" : "below";
  return `Sits ${dir} the market median on the latest collection date, by ${Math.abs(pct).toFixed(1)}%.`;
}

function fileFor(key: string): string {
  const stem = key
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
  return `BS-04-${stem || "UNK"}`;
}

export function providerDossier(canonical: string): ProviderDossier {
  const known = DOSSIERS[canonical];
  if (known) return known;
  return {
    file: fileFor(canonical),
    role: "source · role not yet filed",
    dossier:
      "No dossier has been filed for this subject yet. The figures on the row are still exactly what GET /api/providers returns — nothing inferred or backfilled.",
  };
}
