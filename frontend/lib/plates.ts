/**
 * The plate registry — the landing's photographic frames.
 *
 * Two art directions, not one image scaled: the desktop plates are the
 * landscape stills, and the two portrait plates are the phone's own frames,
 * served through <picture media> so a phone never downloads the wide crop and
 * a desktop never downloads the tall one.
 *
 * Plates are decoration in the strict sense — they carry no data, so they
 * carry no alt text and never state a figure. Everything factual on this page
 * is type.
 */

export interface PlateSpec {
  /** Fallback (widest) source. */
  src: string;
  width: number;
  height: number;
  /** Ordered <source> list; the first matching media wins. */
  sources: { media?: string; srcSet: string }[];
  /** Slate printed in the frame's corner, film-leader style. */
  slate: string;
  /** object-position for the wide crop. */
  position?: string;
  /** object-position for the narrow crop, when a portrait plate is supplied. */
  positionMobile?: string;
}

const P = "/plates";

/**
 * Act I. A dark data-hall corridor: racks recede into a warm distant light.
 * Phones get the portrait crop (dark lower half for the hook); desktops get
 * the landscape frame with negative space on the left for type.
 */
export const COLD_OPEN: PlateSpec = {
  src: `${P}/cold-open-hall-2048.webp`,
  width: 2048,
  height: 1364,
  sources: [
    { media: "(max-width: 767px)", srcSet: `${P}/cold-open-hall-mobile-819.webp` },
    { media: "(max-width: 1280px)", srcSet: `${P}/cold-open-hall-1024.webp` },
    { srcSet: `${P}/cold-open-hall-2048.webp` },
  ],
  slate: "Plate 00 · cold open",
  /* Bias right so the aisle and racks read; left stays in shadow for type. */
  position: "68% 48%",
  /* Portrait crop already parks type in the black lower field. */
  positionMobile: "50% 28%",
};

/**
 * Act III · Exhibit A — the cheap side of the puzzle: a marketplace host
 * rack, unfinished room. Decoration only; type carries the live quote.
 */
export const PUZZLE_MARKETPLACE: PlateSpec = {
  src: `${P}/puzzle-marketplace-2048.webp`,
  width: 2048,
  height: 1366,
  sources: [
    { media: "(max-width: 767px)", srcSet: `${P}/puzzle-marketplace-1024.webp` },
    { srcSet: `${P}/puzzle-marketplace-2048.webp` },
  ],
  slate: "Plate 01a · marketplace",
  position: "50% 45%",
};

/**
 * Act III · Exhibit A — the costly side: an administered-catalog aisle.
 * Paired with PUZZLE_MARKETPLACE; never states a figure on its own.
 */
export const PUZZLE_HYPERSCALER: PlateSpec = {
  src: `${P}/puzzle-hyperscaler-2048.webp`,
  width: 2048,
  height: 1364,
  sources: [
    { media: "(max-width: 767px)", srcSet: `${P}/puzzle-hyperscaler-1024.webp` },
    { srcSet: `${P}/puzzle-hyperscaler-2048.webp` },
  ],
  slate: "Plate 01b · hyperscaler",
  position: "50% 50%",
};

/** Act IV · The name — analyst at the desk, right-anchored on film. */
export const NAME_BACKDROP: PlateSpec = {
  src: `${P}/finding-analyst-1600.webp`,
  width: 1024,
  height: 682,
  sources: [
    {
      media: "(max-width: 767px)",
      srcSet: `${P}/finding-analyst-mobile-819.webp`,
    },
    { media: "(max-width: 1280px)", srcSet: `${P}/finding-analyst-900.webp` },
    { srcSet: `${P}/finding-analyst-1600.webp` },
  ],
  slate: "Plate 03 · the desk",
  position: "78% 46%",
  positionMobile: "62% 38%",
};

/** Act VIII, card three: reading the printout. */
export const FINDING_ANALYST: PlateSpec = {
  src: `${P}/finding-analyst-1600.webp`,
  width: 1024,
  height: 682,
  sources: [
    {
      media: "(max-width: 767px)",
      srcSet: `${P}/finding-analyst-mobile-819.webp`,
    },
    { media: "(max-width: 1280px)", srcSet: `${P}/finding-analyst-900.webp` },
    { srcSet: `${P}/finding-analyst-1600.webp` },
  ],
  slate: "Plate 06 · reading the printout",
  position: "54% 46%",
  positionMobile: "50% 24%",
};

/** Act IX: the floor the rules get written for. */
export const STAKES_FLOOR: PlateSpec = {
  src: `${P}/stakes-floor-1920.webp`,
  width: 1920,
  height: 1280,
  sources: [
    { media: "(max-width: 767px)", srcSet: `${P}/stakes-floor-1200.webp` },
    { media: "(max-width: 1280px)", srcSet: `${P}/stakes-floor-1200.webp` },
    { srcSet: `${P}/stakes-floor-1920.webp` },
  ],
  slate: "Plate 07 · the floor",
  position: "50% 38%",
  positionMobile: "44% 40%",
};
