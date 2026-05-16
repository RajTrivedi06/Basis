"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const HERO_STATS: { label: string; value: string; residual?: boolean }[] = [
  { label: "Providers tracked", value: "4" },
  { label: "Collections per day", value: "2×" },
  { label: "Variance model", value: "Sequential ANOVA" },
  { label: "Headline residual", value: "~59% / ~89%", residual: true },
];

/**
 * Hero for the methodology page. Renders a layered headline with a subtle
 * mouse/scroll-driven parallax on the background grid and glow. The numeric
 * tape at the bottom mirrors the same statistical-research voice used on the
 * Findings page so the page feels continuous with the rest of the site.
 */
export function MethodologyHero() {
  const [scrollY, setScrollY] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setScrollY(window.scrollY);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const gridStyle: CSSProperties = {
    transform: `translate3d(0, ${scrollY * 0.18}px, 0)`,
  };
  const glowStyle: CSSProperties = {
    transform: `translate3d(0, ${scrollY * 0.08}px, 0)`,
  };

  return (
    <header className="relative overflow-hidden pb-12 pt-16 sm:pt-20">
      <div className="meth-grid-bg" style={gridStyle} aria-hidden />
      <div className="meth-glow" style={glowStyle} aria-hidden />

      <div className="relative z-10">
        <div
          className="eyebrow basis-fade"
          style={{ "--basis-delay": "60ms" } as CSSProperties}
        >
          Methodology · Variance accounting
        </div>

        <h1
          className="display basis-fade m-0 mt-5 max-w-[18ch] text-[clamp(2.6rem,6.4vw,4.6rem)] font-normal leading-[0.98] tracking-[-0.025em] text-[var(--ink-hi)]"
          style={{ "--basis-delay": "180ms" } as CSSProperties}
        >
          How Basis measures
          <br />
          <em className="font-serif italic text-[var(--ink-mid)]">
            what it cannot
          </em>{" "}
          explain.
        </h1>

        <p
          className="basis-fade mt-7 max-w-[58ch] font-serif text-[clamp(16px,1.6vw,20px)] leading-[1.55] text-[var(--ink-mid)]"
          style={{ "--basis-delay": "360ms" } as CSSProperties}
        >
          Basis is a variance-accounting study, not a forecasting engine. The
          rules stay explicit because interpretability is part of the claim —
          the residual is only meaningful when every adjustment it survives is
          auditable line by line.
        </p>

        <div
          className="basis-fade mt-10"
          style={{ "--basis-delay": "520ms" } as CSSProperties}
        >
          <div className="stat-tape">
            {HERO_STATS.map((s) => (
              <div key={s.label} className="stat-tape__cell">
                <div
                  className={`stat-tape__num ${s.residual ? "is-residual" : ""}`}
                >
                  {s.value}
                </div>
                <div className="stat-tape__label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="scroll-cue basis-fade"
          style={{ "--basis-delay": "720ms" } as CSSProperties}
          aria-hidden
        >
          <span>Scroll to read</span>
          <span className="scroll-cue__line" />
        </div>
      </div>
    </header>
  );
}
