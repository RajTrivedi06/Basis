/**
 * Basis wordmark lockup — mark + divider + "basis" / "residual research".
 * Source: final lockup spec (notched square SVG, mono wordmark + sans caption).
 */

const MARK_PATH = "M0,0 L64,0 L64,46.08 L46.08,46.08 L46.08,64 L0,64 Z";

type BasisLogoProps = {
  /** header = nav island; footer = site footer; mark = icon only */
  variant?: "header" | "footer" | "mark";
  className?: string;
};

export function BasisLogo({ variant = "header", className = "" }: BasisLogoProps) {
  const rootClass = [
    "basis-logo",
    `basis-logo--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={rootClass}>
      <svg
        className="basis-logo__mark"
        viewBox="0 0 64 64"
        aria-hidden
        focusable="false"
      >
        <path d={MARK_PATH} fill="currentColor" />
      </svg>

      {variant !== "mark" ? (
        <>
          <span className="basis-logo__divider" aria-hidden />
          <span className="basis-logo__stack">
            <span className="basis-logo__word">basis</span>
            <span className="basis-logo__cap">residual research</span>
          </span>
        </>
      ) : null}
    </span>
  );
}
