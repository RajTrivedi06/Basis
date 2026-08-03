"use client";

import { BracketMonogram, useDrawOnce } from "@/components/marks/BracketMark";

interface BasisLockupProps {
  /** header = nav island; footer = site footer; mark = monogram only */
  variant?: "header" | "footer" | "mark";
  className?: string;
}

/**
 * The nav lockup (exploration variant 1c): the bracket monogram beside the
 * "Basis" wordmark. The mark is the measurement — the same dimension bracket
 * that measures the gap everywhere else on the site.
 */
export function BasisLockup({
  variant = "header",
  className = "",
}: BasisLockupProps) {
  const { ref, drawing } = useDrawOnce<HTMLSpanElement>();

  const rootClass = [
    "basis-lockup",
    `basis-lockup--${variant}`,
    drawing ? "is-bracket-drawing" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span ref={ref} className={rootClass}>
      <BracketMonogram
        size={variant === "footer" ? 15 : 18}
        className="basis-lockup__mark"
      />
      {variant !== "mark" ? (
        <span className="basis-lockup__word">Basis</span>
      ) : null}
    </span>
  );
}
