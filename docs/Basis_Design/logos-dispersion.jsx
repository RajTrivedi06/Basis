/* global React */
// Basis — Dispersion variations. Each is a take on the box-and-whisker /
// five-number-summary as a logo mark. Residual/median in amber.

const AMBER = '#f59e0b';

// v1 · Classic box-whisker, median in amber (original)
function DispA({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M10 32 L54 32" stroke={ink} strokeWidth="1.5" />
      <path d="M10 26 L10 38 M54 26 L54 38" stroke={ink} strokeWidth="1.5" />
      <rect x="20" y="22" width="24" height="20" fill="none" stroke={ink} strokeWidth="1.5" />
      <path d="M30 22 L30 42" stroke={amber} strokeWidth="2.5" />
    </svg>
  );
}

// v2 · Vertical box-whisker (portrait candle)
function DispB({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M32 8 L32 56" stroke={ink} strokeWidth="1.5" />
      <path d="M26 8 L38 8 M26 56 L38 56" stroke={ink} strokeWidth="1.5" />
      <rect x="22" y="20" width="20" height="24" fill="none" stroke={ink} strokeWidth="1.5" />
      <path d="M22 30 L42 30" stroke={amber} strokeWidth="2.5" />
    </svg>
  );
}

// v3 · Filled box, median as cut (strong silhouette)
function DispC({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M10 32 L20 32 M44 32 L54 32" stroke={ink} strokeWidth="1.5" />
      <path d="M10 26 L10 38 M54 26 L54 38" stroke={ink} strokeWidth="1.5" />
      <rect x="20" y="20" width="24" height="24" fill={ink} />
      <rect x="29" y="20" width="3" height="24" fill={amber} />
    </svg>
  );
}

// v4 · Three nested rectangles (IQR within range), median bar
function DispD({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="6"  y="26" width="52" height="12" fill="none" stroke={ink} strokeWidth="1.25" opacity="0.35" />
      <rect x="18" y="22" width="28" height="20" fill="none" stroke={ink} strokeWidth="1.5" />
      <path d="M30 22 L30 42" stroke={amber} strokeWidth="2.5" />
    </svg>
  );
}

// v5 · Five ticks of a five-number summary — min, q1, median, q3, max
function DispE({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M6 32 L58 32" stroke={ink} strokeWidth="1" />
      <path d="M6 24 L6 40" stroke={ink} strokeWidth="1.5" />
      <path d="M20 22 L20 42" stroke={ink} strokeWidth="1.5" />
      <path d="M32 18 L32 46" stroke={amber} strokeWidth="2.5" />
      <path d="M44 22 L44 42" stroke={ink} strokeWidth="1.5" />
      <path d="M58 24 L58 40" stroke={ink} strokeWidth="1.5" />
    </svg>
  );
}

// v6 · Box with outlier dot (amber) — asymmetric dispersion story
function DispF({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M12 32 L48 32" stroke={ink} strokeWidth="1.5" />
      <path d="M12 26 L12 38" stroke={ink} strokeWidth="1.5" />
      <rect x="20" y="22" width="22" height="20" fill="none" stroke={ink} strokeWidth="1.5" />
      <path d="M28 22 L28 42" stroke={ink} strokeWidth="1.5" />
      <circle cx="56" cy="32" r="3.5" fill={amber} />
    </svg>
  );
}

// v7 · Three stacked box-whiskers at decreasing dispersion — the
// "fungibility matrix" in one glance. Top row amber.
function DispG({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  const row = (y, x1, x2, bx1, bx2, mx, color, w) => (
    <g>
      <path d={`M${x1} ${y} L${x2} ${y}`} stroke={color} strokeWidth={w} />
      <rect x={bx1} y={y-5} width={bx2-bx1} height="10" fill="none" stroke={color} strokeWidth={w} />
      <path d={`M${mx} ${y-5} L${mx} ${y+5}`} stroke={color} strokeWidth={w} />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {row(18, 6, 58, 14, 48, 26, amber, 1.5)}
      {row(32, 14, 50, 20, 42, 30, ink, 1.25)}
      {row(46, 22, 46, 26, 40, 32, ink, 1)}
    </svg>
  );
}

// v8 · Quartile blocks — Q1, Q2, Q3, Q4 as four unequal bars.
// Q2–Q3 (IQR) solid ink; Q1/Q4 (whiskers) hairline; median seam amber.
function DispH({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="6"  y="28" width="12" height="8"  fill="none" stroke={ink} strokeWidth="1.25" />
      <rect x="20" y="22" width="12" height="20" fill={ink} opacity="0.55" />
      <rect x="34" y="22" width="12" height="20" fill={ink} />
      <rect x="48" y="28" width="10" height="8"  fill="none" stroke={ink} strokeWidth="1.25" />
      <rect x="32" y="20" width="2"  height="24" fill={amber} />
    </svg>
  );
}

// v9 · Box with data points scattered (raw data visible)
function DispI({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M6 32 L58 32" stroke={ink} strokeWidth="1" opacity="0.5" />
      <rect x="18" y="22" width="28" height="20" fill="none" stroke={ink} strokeWidth="1.5" />
      <path d="M30 22 L30 42" stroke={amber} strokeWidth="2.5" />
      {/* scatter */}
      <circle cx="10" cy="32" r="1.25" fill={ink} />
      <circle cx="14" cy="34" r="1.25" fill={ink} />
      <circle cx="22" cy="28" r="1.25" fill={ink} />
      <circle cx="38" cy="36" r="1.25" fill={ink} />
      <circle cx="50" cy="30" r="1.25" fill={ink} />
      <circle cx="56" cy="32" r="1.25" fill={ink} />
    </svg>
  );
}

// v10 · Violin silhouette (distribution shape, not box)
function DispJ({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M32 10 C 44 18, 48 28, 42 32 C 48 36, 44 46, 32 54 C 20 46, 16 36, 22 32 C 16 28, 20 18, 32 10 Z" fill="none" stroke={ink} strokeWidth="1.5" />
      <path d="M22 32 L42 32" stroke={amber} strokeWidth="2.5" />
    </svg>
  );
}

// v11 · Typographic — bracket pair with median dot inside
function DispK({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M18 14 L10 14 L10 50 L18 50" stroke={ink} strokeWidth="2" strokeLinecap="square" fill="none" />
      <path d="M46 14 L54 14 L54 50 L46 50" stroke={ink} strokeWidth="2" strokeLinecap="square" fill="none" />
      <circle cx="32" cy="32" r="5" fill={amber} />
      <path d="M20 32 L27 32 M37 32 L44 32" stroke={ink} strokeWidth="1.25" />
    </svg>
  );
}

// v12 · Box-whisker becomes the letter B (the stem being the whisker)
function DispL({ size = 64, ink = '#eef1f8', amber = AMBER }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M12 10 L12 54" stroke={ink} strokeWidth="2" />
      <path d="M6 10 L18 10 M6 54 L18 54" stroke={ink} strokeWidth="2" />
      <rect x="22" y="18" width="30" height="12" fill="none" stroke={ink} strokeWidth="1.5" />
      <rect x="22" y="34" width="36" height="12" fill="none" stroke={ink} strokeWidth="1.5" />
      <path d="M32 18 L32 30" stroke={amber} strokeWidth="2.25" />
      <path d="M38 34 L38 46" stroke={amber} strokeWidth="2.25" />
    </svg>
  );
}

Object.assign(window, { DispA, DispB, DispC, DispD, DispE, DispF, DispG, DispH, DispI, DispJ, DispK, DispL });
