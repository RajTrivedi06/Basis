"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll-entered reveal (design doc §5 motion inventory; §13 law 2:
 * scroll drives, nothing autoplays). The children are ALWAYS in the
 * server HTML — this wrapper only toggles `data-seen`, and CSS does the
 * motion. With prefers-reduced-motion, CSS renders the final state and
 * this component is inert by construction.
 */
export function Reveal({
  children,
  delayMs = 0,
}: {
  children: React.ReactNode;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (typeof IntersectionObserver === "undefined") {
      el.setAttribute("data-seen", "true");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-seen", "true");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal
      style={
        delayMs > 0
          ? ({ "--reveal-delay": `${delayMs}ms` } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
}
