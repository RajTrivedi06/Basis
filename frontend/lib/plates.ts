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
 * Act I. A wall of filing drawers: the archive the whole page is a copy from.
 * Phones get the corridor crop, which is nearly black across its lower half,
 * so the hook's type sits on the plate rather than on a scrim.
 */
export const COLD_OPEN: PlateSpec = {
  src: `${P}/ledger-files-1920.webp`,
  width: 1920,
  height: 1280,
  sources: [
    { media: "(max-width: 767px)", srcSet: `${P}/hero-corridor-900.webp` },
    { media: "(max-width: 1280px)", srcSet: `${P}/ledger-files-1200.webp` },
    { srcSet: `${P}/ledger-files-1920.webp` },
  ],
  slate: "Plate 00 · the archive",
  position: "50% 42%",
  positionMobile: "62% 22%",
};

/** Act IV, phones only: the sheet, the stamp, and the bracket drawn by hand. */
export const NAME_STILL: PlateSpec = {
  src: `${P}/name-still-900.webp`,
  width: 900,
  height: 1124,
  sources: [
    { media: "(max-width: 430px)", srcSet: `${P}/name-still-640.webp` },
    { srcSet: `${P}/name-still-900.webp` },
  ],
  slate: "Plate 02 · the mark",
  position: "50% 18%",
};

/** Act VIII, card three: reading the printout. */
export const FINDING_ANALYST: PlateSpec = {
  src: `${P}/finding-analyst-1600.webp`,
  width: 1600,
  height: 1067,
  sources: [
    { media: "(max-width: 767px)", srcSet: `${P}/finding-analyst-900.webp` },
    { srcSet: `${P}/finding-analyst-1600.webp` },
  ],
  slate: "Plate 06 · reading the printout",
  position: "54% 46%",
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
