/**
 * Glossary definitions — Stage 6 design doc §10, row C21.
 *
 * These strings are FINAL COPY from the signed design doc (voice pass complete
 * 2026-08-02, Director seeds adopted). They are reproduced verbatim and must
 * not be reworded, expanded, or "clarified" here. If a definition needs to
 * change, the design doc changes first.
 */

export type GlossaryTermKey = "residual" | "spot" | "decomposition" | "icc";

export interface GlossaryEntry {
  /** Term as the glossary names it; the inline trigger may render other text. */
  term: string;
  /** C21 definition, verbatim. */
  definition: string;
}

export const GLOSSARY: Record<GlossaryTermKey, GlossaryEntry> = {
  residual: {
    term: "Residual",
    definition:
      "the share of price differences left over after accounting for everything sellers publicly disclose.",
  },
  spot: {
    term: "Spot",
    definition:
      "discounted capacity the provider can take back at any time.",
  },
  decomposition: {
    term: "Decomposition",
    definition:
      "splitting total price variation into named causes, one factor at a time.",
  },
  icc: {
    term: "ICC",
    definition:
      "how much of the leftover variation sticks to the same specific machines day after day.",
  },
};
