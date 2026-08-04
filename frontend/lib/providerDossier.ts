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
      "Largest contributor to the corpus by a wide margin, and the widest internal disagreement. Prices are set by many unrelated operators, so the aggregate sits below the market median without any single actor pricing low. Feature-rich listings; the only subject whose host identity can be traced day to day.",
  },
  runpod: {
    file: "BS-04-RUNP",
    role: "curated cloud · published catalog, operator-set",
    dossier:
      "A published price list, revised rarely. Sits just under the market median with a narrow spread, which is what a single pricing authority looks like when it is quoting the same catalog twice a day.",
  },
  aws_spot: {
    file: "BS-04-AWS",
    role: "hyperscaler spot · regional, contract-shaped",
    dossier:
      "Sits above the market median. Read as posture, not markup: this subject is concentrated in regions and bundle configurations the marketplace barely lists, and its commitment mix differs. Whether the same offer costs more is a question for the decomposition, not this sheet.",
  },
  lambda: {
    file: "BS-04-LAMB",
    role: "curated cloud · short catalog, few regions",
    dossier:
      "Small and consistent. Covers a short catalog of canonical SKUs, so its Δ leans on a handful of comparisons and moves more than the larger subjects when one SKU shifts.",
  },
  tensordock: {
    file: "BS-04-TDCK",
    role: "marketplace · collection stopped, history kept",
    dossier:
      "No successful collection in seven days, so the subject is tagged and sorted below the active. Its historical offers remain in the corpus and in the totals; only the claim of live observation is withdrawn. A single successful collection reinstates it automatically.",
  },
};

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
