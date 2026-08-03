"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getProviders } from "@/lib/api";
import { partitionProviders } from "@/lib/providerStatus";

/**
 * Hero for the methodology page (design doc §10, rows C15/C16).
 *
 * The headline is final copy. The stat strip is live where it can be: the
 * provider figure counts the providers the API says are still collecting, so
 * a retirement or a new collector changes the page without a deploy. The
 * residual cell carries truth-patch range language rather than a point value,
 * per design doc §7 — a bare share would go stale between weeks.
 */
export function MethodologyHero() {
  const [scrollY, setScrollY] = useState(0);
  const rafRef = useRef<number | null>(null);

  const providersQuery = useQuery({
    queryKey: ["providers"],
    queryFn: getProviders,
  });

  const activeProviders = providersQuery.data
    ? partitionProviders(providersQuery.data.items).active.length
    : null;

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

  const heroStats: { label: string; value: string; residual?: boolean }[] = [
    {
      // Label deliberately reads "Active providers", not "providers tracked":
      // the retired "<n> providers" corpus claim is a banned string and the
      // smoke suite greps for it adjacent to a digit.
      label: "Active providers",
      value: activeProviders === null ? "—" : String(activeProviders),
    },
    { label: "Collections per day", value: "2×" },
    { label: "Variance model", value: "Sequential ANOVA" },
    {
      label: "Residual · market-priced",
      value: "~20–61%",
      residual: true,
    },
  ];

  return (
    <div className="meth-hero-shell">
      <div className="meth-grid-bg" style={gridStyle} aria-hidden />
      <div className="meth-glow" style={glowStyle} aria-hidden />

      <header className="meth-hero">
        <div className="meth-hero__content">
        <div
          className="eyebrow basis-fade"
          style={{ "--basis-delay": "60ms" } as CSSProperties}
        >
          06 · Methodology
        </div>

        <h1
          className="display basis-fade m-0 mt-5 max-w-[18ch] text-[clamp(2.6rem,6.4vw,4.6rem)] font-normal leading-[0.98] tracking-[-0.025em] text-[var(--ink-hi)]"
          style={{ "--basis-delay": "180ms" } as CSSProperties}
        >
          Measuring what the market{" "}
          <em className="font-serif italic text-[var(--ink-mid)]">
            cannot explain.
          </em>
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
            {heroStats.map((s) => (
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
    </div>
  );
}
