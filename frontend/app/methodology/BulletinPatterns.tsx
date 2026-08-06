/** Shared SVG hatch patterns for ledger / IQR exhibits.
 * Hex fills (not CSS vars) so pattern paints reliably across browsers. */
export function BulletinPatterns() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute" }}
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="bull-hA"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="6" height="6" fill="#FAF9F5" />
          <line
            x1="1"
            y1="0"
            x2="1"
            y2="6"
            stroke="#1F1D1A"
            strokeWidth="1.7"
          />
        </pattern>
        <pattern
          id="bull-hB"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <rect width="7" height="7" fill="#FAF9F5" />
          <line
            x1="1"
            y1="0"
            x2="1"
            y2="7"
            stroke="#1F1D1A"
            strokeWidth="1.4"
          />
          <line
            x1="0"
            y1="1"
            x2="7"
            y2="1"
            stroke="#1F1D1A"
            strokeWidth="1.4"
          />
        </pattern>
        <pattern
          id="bull-hC"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
        >
          <rect width="7" height="7" fill="#FAF9F5" />
          <circle cx="3.5" cy="3.5" r="1.5" fill="#1F1D1A" />
        </pattern>
        <pattern
          id="bull-hD"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
        >
          <rect width="6" height="6" fill="#FAF9F5" />
          <line
            x1="1"
            y1="0"
            x2="1"
            y2="6"
            stroke="#1F1D1A"
            strokeWidth="1.7"
          />
        </pattern>
        <pattern
          id="bull-hE"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <rect width="8" height="8" fill="#F3F1E9" />
          <line
            x1="0"
            y1="2"
            x2="8"
            y2="2"
            stroke="#6B675E"
            strokeWidth="1"
          />
        </pattern>
      </defs>
    </svg>
  );
}
