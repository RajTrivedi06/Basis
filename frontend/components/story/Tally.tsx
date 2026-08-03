"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tally-stamp count-up (§13 law 3: count-ups ONLY for API-served values —
 * every use site receives a live number fetched server-side). The final
 * value is in the server HTML; the tween only runs after hydration, when
 * the element scrolls into view, and never under prefers-reduced-motion.
 */
export function Tally({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  grouping = false,
  durationMs = 1400,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Thousands separators (en-US). */
  grouping?: boolean;
  durationMs?: number;
}) {
  const format = (n: number) => {
    const body = grouping
      ? Math.round(n).toLocaleString("en-US")
      : n.toFixed(decimals);
    return `${prefix}${body}${suffix}`;
  };
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(() => format(value));

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(format(value));
      return;
    }

    let raf = 0;
    const run = () => {
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / durationMs);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplay(format(value * eased));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            run();
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs, decimals, prefix, suffix, grouping]);

  return (
    <span ref={ref} style={{ fontVariantNumeric: "tabular-nums" }}>
      {display}
    </span>
  );
}
