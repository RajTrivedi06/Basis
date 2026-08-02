"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const TARGET_PCT = 51;
const ANIMATION_MS = 1400;

/**
 * The page's closing visual: a tall amber meter that fills from zero to the
 * indicative residual share as the panel enters view. The numeric label and
 * bar are driven by the same `isVisible` flag so they stay in lockstep,
 * matching the prose to the right.
 *
 * The meter targets the market-priced segments (marketplaces + spot), whose
 * Jul 12–27 four-provider window averaged 51.0% unexplained. Pooled figures
 * that include the Azure/GCP list catalogs are not comparable and are
 * discussed in the adjacent prose instead.
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
              <span>Residual · market-priced segments</span>
              <span>Indicative · Jul 12–27 2026 average</span>
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
          In market-priced segments (marketplaces + spot), observable factors
          fail to explain roughly{" "}
          <span className="tok">20–61%</span> of H100 price variance week to
          week; in administered catalogs the same factors explain nearly
          everything — segment-conditionality is the finding.
        </p>
        <p className="mt-4 max-w-[58ch] font-serif text-[16px] leading-[1.7] text-[var(--ink-mid)]">
          Pool in Azure/GCP&rsquo;s fixed list catalogs (joined Jul 28) and the
          pooled residual collapses to single digits — administered prices are
          explainable by construction, which is precisely why a compute
          benchmark must be segment-aware.
        </p>
      </div>
    </div>
  );
}
