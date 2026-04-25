/* global React */
// Basis — logo marks. Each mark is a standalone SVG component that can render
// at any size. All speak to basis / the gap between benchmark and actual.

// Helper: amber residual color
const AMBER = '#f59e0b';

// ── Mark 01 · Gap ──────────────────────────────────────────────
// Two parallel lines — the benchmark and the actual — with an amber wedge
// between them. The gap IS the basis.
function LogoGap({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M6 20 L58 20" stroke={ink} strokeWidth="2" strokeLinecap="square" />
      <path d="M6 44 L58 44" stroke={ink} strokeWidth="2" strokeLinecap="square" />
      <rect x="26" y="22" width="12" height="20" fill={amber} />
    </svg>
  );
}

// ── Mark 02 · Tick ─────────────────────────────────────────────
// A single basis-point tick on a ruled line. Minimal, typographic.
function LogoTick({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M6 40 L58 40" stroke={ink} strokeWidth="1.5" />
      <path d="M32 40 L32 18" stroke={amber} strokeWidth="3" strokeLinecap="square" />
      {/* small cross-ticks */}
      <path d="M14 40 L14 44 M22 40 L22 44 M42 40 L42 44 M50 40 L50 44" stroke={ink} strokeWidth="1" />
    </svg>
  );
}

// ── Mark 03 · Residual stack ───────────────────────────────────
// Stacked horizontal bars of decreasing width — the decomposition —
// with the final, largest bar in amber (the residual).
function LogoStack({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="10" y="14" width="20" height="5" fill={ink} opacity="0.45" />
      <rect x="10" y="22" width="28" height="5" fill={ink} opacity="0.55" />
      <rect x="10" y="30" width="16" height="5" fill={ink} opacity="0.35" />
      <rect x="10" y="38" width="12" height="5" fill={ink} opacity="0.28" />
      <rect x="10" y="46" width="44" height="5" fill={amber} />
    </svg>
  );
}

// ── Mark 04 · Beta ─────────────────────────────────────────────
// The Greek β, typographic, set in a heavy serif. β is the regression
// coefficient that's explicitly NOT residual.
function LogoBeta({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <text x="32" y="48"
        textAnchor="middle"
        fontFamily='"Fraunces", Georgia, serif'
        fontSize="54"
        fontWeight="400"
        fill={ink}
        fontStyle="italic">β</text>
      <circle cx="50" cy="16" r="4" fill={amber} />
    </svg>
  );
}

// ── Mark 05 · Dispersion box ───────────────────────────────────
// A box-and-whisker silhouette. The median is amber.
function LogoBox({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* whisker line */}
      <path d="M10 32 L54 32" stroke={ink} strokeWidth="1.5" />
      {/* endpoints */}
      <path d="M10 26 L10 38 M54 26 L54 38" stroke={ink} strokeWidth="1.5" />
      {/* box */}
      <rect x="20" y="22" width="24" height="20" fill="none" stroke={ink} strokeWidth="1.5" />
      {/* median */}
      <path d="M30 22 L30 42" stroke={amber} strokeWidth="2.5" />
    </svg>
  );
}

// ── Mark 06 · B (structural) ───────────────────────────────────
// The letter B, constructed from two stacked panels. The lower (larger)
// panel is amber — again echoing the dominance of residual.
function LogoB({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* spine */}
      <rect x="14" y="12" width="4" height="40" fill={ink} />
      {/* upper bowl — explained */}
      <path d="M18 12 L34 12 A8 8 0 0 1 42 20 L42 24 A8 8 0 0 1 34 32 L18 32 Z" fill={ink} />
      {/* lower bowl — residual, amber */}
      <path d="M18 32 L38 32 A10 10 0 0 1 48 42 L48 42 A10 10 0 0 1 38 52 L18 52 Z" fill={amber} />
    </svg>
  );
}

// ── Mark 07 · Delta ────────────────────────────────────────────
// A triangle (delta — change, gap). Base in ink, peak split by amber seam.
function LogoDelta({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M32 10 L54 50 L10 50 Z" fill="none" stroke={ink} strokeWidth="2" strokeLinejoin="miter" />
      <path d="M32 10 L32 50" stroke={amber} strokeWidth="2.5" />
    </svg>
  );
}

// ── Mark 08 · Futures ──────────────────────────────────────────
// Two candlesticks — benchmark (ink) and actual (amber) — at different
// prices. The gap between them is the basis.
function LogoFutures({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* left candle — benchmark */}
      <path d="M22 14 L22 50" stroke={ink} strokeWidth="1" />
      <rect x="17" y="22" width="10" height="18" fill="none" stroke={ink} strokeWidth="1.5" />
      {/* right candle — actual, amber */}
      <path d="M44 20 L44 54" stroke={amber} strokeWidth="1" />
      <rect x="39" y="32" width="10" height="14" fill={amber} />
    </svg>
  );
}

// ── Mark 09 · Crosshair / aim ──────────────────────────────────
// A crosshair where the target isn't at center — the miss is the basis.
function LogoCrosshair({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="18" stroke={ink} strokeWidth="1.5" />
      <circle cx="32" cy="32" r="10" stroke={ink} strokeWidth="1" opacity="0.5" />
      <path d="M32 6 L32 18 M32 46 L32 58 M6 32 L18 32 M46 32 L58 32" stroke={ink} strokeWidth="1.5" />
      <circle cx="40" cy="26" r="3.5" fill={amber} />
    </svg>
  );
}

// ── Mark 10 · Hedge ────────────────────────────────────────────
// Two curves — hedged and actual — that should overlap but don't quite.
// The shaded gap between them is the basis.
function LogoHedge({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M6 46 Q 20 22, 32 30 T 58 18" stroke={ink} strokeWidth="1.75" fill="none" />
      <path d="M6 50 Q 20 30, 32 36 T 58 26" stroke={amber} strokeWidth="1.75" fill="none" />
      {/* basis shading between them */}
      <path d="M6 46 Q 20 22, 32 30 T 58 18 L 58 26 Q 46 28, 32 36 T 6 50 Z" fill={amber} opacity="0.12" />
    </svg>
  );
}

// ── Mark 11 · Benchmark serif ──────────────────────────────────
// An editorial, serif ampersand-style ligature for "b" set as the
// wordmark's first character, split by a residual notch.
function LogoNotch({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <text x="32" y="50"
        textAnchor="middle"
        fontFamily='"Fraunces", Georgia, serif'
        fontSize="56"
        fontStyle="italic"
        fontWeight="300"
        fill={ink}>b</text>
      <rect x="31" y="26" width="4" height="26" fill={amber} />
    </svg>
  );
}

// ── Mark 12 · Cup (optimistic / minimal) ───────────────────────
// A single open bracket — the opening of a decomposition — with amber dot.
function LogoCup({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M18 14 L18 46 A10 10 0 0 0 28 56 L36 56" stroke={ink} strokeWidth="2.5" strokeLinecap="square" fill="none" />
      <circle cx="42" cy="56" r="4" fill={amber} />
    </svg>
  );
}

Object.assign(window, {
  LogoGap, LogoTick, LogoStack, LogoBeta, LogoBox, LogoB,
  LogoDelta, LogoFutures, LogoCrosshair, LogoHedge, LogoNotch, LogoCup,
});
