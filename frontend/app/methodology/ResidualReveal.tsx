"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const TARGET_PCT = 59;
const ANIMATION_MS = 1400;

/**
 * The page's closing visual: a tall amber meter that fills from zero to the
 * indicative residual share as the panel enters view. The numeric label and
 * bar are driven by the same `isVisible` flag so they stay in lockstep,
 * matching the prose to the right.
 *
 * The meter targets the headline Vast-included residual (~59%); the
 * Vast-excluded counterpart (~89%) is surfaced in the adjacent prose to
 * keep the dual-headline framing consistent across the site.
 */
export function ResidualReveal() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.32, rootMargin: "0px 0px -10% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Numeric tween that mirrors the CSS bar fill. Only runs once the panel
  // enters view so the number aligns with the bar's growth.
  useEffect(() => {
    if (!isVisible) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setDisplay(TARGET_PCT);
      return;
    }

    let raf: number;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / ANIMATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(TARGET_PCT * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isVisible]);

  return (
    <div
      ref={wrapperRef}
      className={`reveal residual-reveal ${isVisible ? "is-in" : ""}`}
    >
      <div
        className="residual-meter"
        style={{ "--meter-fill": `${TARGET_PCT}%` } as CSSProperties}
      >
        <div className="residual-meter__tick" style={{ top: "25%" }} aria-hidden />
        <div className="residual-meter__tick" style={{ top: "50%" }} aria-hidden />
        <div className="residual-meter__tick" style={{ top: "75%" }} aria-hidden />

        <div className="residual-meter__fill">
          <div className="residual-meter__inner">
            <div className="residual-meter__cap">
              <span>Residual · Vast included</span>
              <span>Indicative · 18-day window (2026-04-26 → 2026-05-13)</span>
            </div>
            <div className="residual-meter__num">~{display}%</div>
          </div>
        </div>

        <div className="residual-meter__caption">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      <div>
        <div className="eyebrow mb-3">The headline finding</div>
        <h3 className="m-0 font-serif text-[clamp(1.6rem,3.4vw,2.1rem)] font-normal leading-[1.1] tracking-[-0.015em] text-[var(--ink-hi)]">
          The residual is the{" "}
          <em className="text-[var(--residual)]">basis risk</em> a compute
          benchmark would have to absorb.
        </h3>
        <p className="mt-5 max-w-[58ch] font-serif text-[16px] leading-[1.7] text-[var(--ink-mid)]">
          It is the portion of log-price dispersion that cannot be explained
          by region, commitment, provider identity, or bundle composition —
          the irreducible mismatch between a single reference price and what a
          specific buyer actually pays.
        </p>
        <p className="mt-4 max-w-[58ch] font-serif text-[16px] leading-[1.7] text-[var(--ink-mid)]">
          Across the 18-day window 2026-04-26 → 2026-05-13, the H100 SXM 80GB
          residual ran near <span className="tok">~59%</span> with all four
          providers included and{" "}
          <span className="tok">~89%</span> with Vast.ai excluded. Both
          numbers are basis risk benchmark designs have to live with — the
          headline depends on which segment of the market you measure.
        </p>
      </div>
    </div>
  );
}
