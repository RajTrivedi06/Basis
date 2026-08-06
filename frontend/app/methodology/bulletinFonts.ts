/**
 * The bulletin's own five faces, per the design spec. Loaded through
 * next/font so they are self-hosted and preloaded rather than fetched from
 * fonts.googleapis.com at render time — the rest of the site loads its two
 * faces the same way (see app/layout.tsx).
 *
 * These are scoped to the methodology route: the variables are attached to
 * the bulletin's own wrapper, so no other page inherits them.
 */
import {
  Caveat,
  Libre_Franklin,
  Playfair_Display,
  Source_Serif_4,
  Special_Elite,
} from "next/font/google";

/** Nameplate, EXTRA slug, drop caps, H1 at 900; every H2/H3 at 800. */
export const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["800", "900"],
  display: "swap",
  variable: "--bull-f-display",
});

/** All-caps kickers, table headers, dateline, captions (700); bylines (500). */
export const libreFranklin = Libre_Franklin({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
  variable: "--bull-f-sans",
});

/** All body copy. */
export const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--bull-f-body",
});

/** Typewriter: file numbers, stamps, chips, annexes, data tables, chart labels. */
export const specialElite = Special_Elite({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--bull-f-type",
});

/** Handwritten marginalia — exactly two instances, §04 and §06. */
export const caveat = Caveat({
  subsets: ["latin"],
  weight: "600",
  display: "swap",
  variable: "--bull-f-hand",
});

export const bulletinFontVars = [
  playfair.variable,
  libreFranklin.variable,
  sourceSerif.variable,
  specialElite.variable,
  caveat.variable,
].join(" ");
