"use client";

import Link from "next/link";
import { useRef, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useSku } from "@/lib/useSku";
import { getBasisTimeseries } from "@/lib/api";
import { getMlExplainability } from "@/lib/mlExplainability";
import { ShowMeHow } from "@/components/disclosure/TwoLayer";
import { FindingMemo } from "@/components/findings/FindingMemo";

gsap.registerPlugin(useGSAP);

// Azure and GCP publish fixed list catalogs; excluding them leaves the
// market-priced segments (marketplaces + spot) the hero speaks about.
const CATALOG_PROVIDERS = ["azure", "gcp"];
const CATALOG_EXCLUSION_KEY = `exclude:${CATALOG_PROVIDERS.join(",")}`;

/**
 * Qualitative share language derived from the live ICC, so the words can
 * never contradict the figure beside them (Quarantine Rule).
 */
export function iccQualifier(icc: number): string {
  if (icc >= 0.5) return "over half";
  if (icc >= 1 / 3) return "a third or more";
  return "a persistent share";
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function FindingsHeroInner() {
  const { sku } = useSku();
  const root = useRef<HTMLElement | null>(null);

  const tsMarket = useQuery({
    queryKey: ["basis-timeseries", sku, null, null, CATALOG_EXCLUSION_KEY],
    queryFn: () =>
      getBasisTimeseries(sku, { excludeProviders: CATALOG_PROVIDERS }),
    retry: 1,
  });
  const artifact = useQuery({
    queryKey: ["ml-explainability"],
    queryFn: () => getMlExplainability(),
    staleTime: 15 * 60 * 1000,
  });

  const points = (tsMarket.data?.points ?? []).map((p) => ({
    date: p.date,
    pct: p.pct_residual,
  }));

  const art = artifact.data ?? null;
  const gapPp = art ? art.metrics.gap * 100 : null;
  const icc = art ? art.host_analysis.icc : null;
  const anovaPct = art ? art.metrics.anova_explained_same_days * 100 : null;
  const trainedDate = art ? shortDate(art.metadata.trained_at) : null;
  const todayPct = points.length > 0 ? points[points.length - 1].pct : null;

  const ready = !tsMarket.isLoading && !artifact.isLoading;
  const windowLabel =
    points.length > 0 ? `~${points.length} days` : "recent weeks";

  // Entrance choreography (design 4a motion script). Everything is visible
  // at rest and animated with from() so a JS failure or reduced-motion
  // preference still leaves a complete, readable memorandum.
  useGSAP(
    () => {
      if (!ready) return;
      const mm = gsap.matchMedia();
      // Typing mutates textContent imperatively, so every label's full
      // string is captured up front and restored on cleanup — an
      // interrupted entrance must never leave a half-typed record.
      const typed: { el: HTMLElement; full: string }[] = [];

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

        tl.from(".fh-eyebrow, .fh-statement, .fh-lede", {
          y: 10,
          opacity: 0,
          duration: 0.4,
          stagger: 0.06,
        });
        tl.from(
          "[data-memo]",
          { x: 34, rotate: 2, opacity: 0, duration: 0.5 },
          0.15
        );

        // Each line of inquiry types, its leader draws, its result stamps.
        // Lines overlap so the whole record is readable in ~2s.
        gsap.utils.toArray<HTMLElement>(".memo-line").forEach((line, i) => {
          const at = 0.45 + i * 0.16;
          const label = line.querySelector<HTMLElement>("[data-type]");
          if (label) {
            const full = label.textContent ?? "";
            typed.push({ el: label, full });
            const state = { n: 0 };
            tl.to(
              state,
              {
                n: full.length,
                duration: Math.min(0.34, full.length * 0.012),
                ease: "none",
                onStart: () => {
                  label.textContent = "";
                },
                onUpdate: () => {
                  label.textContent = full.slice(0, Math.round(state.n));
                },
                onComplete: () => {
                  label.textContent = full;
                },
              },
              at
            );
          }
          const leader = line.querySelector(".memo-line__leader");
          if (leader) tl.from(leader, { scaleX: 0, duration: 0.25 }, at + 0.05);
          const value = line.querySelector(".memo-line__value");
          if (value) tl.from(value, { opacity: 0, y: -3, duration: 0.2 }, at + 0.24);
          const redaction = line.querySelector(".memo-line__redaction");
          if (redaction) {
            tl.from(
              redaction,
              { scaleX: 0, duration: 0.36, ease: "power3.inOut" },
              at + 0.3
            );
          }
        });

        tl.from(
          ".memo__stamp",
          {
            scale: 1.25,
            rotate: -14,
            opacity: 0,
            duration: 0.28,
            ease: "back.out(2.2)",
          },
          1.32
        );

        const line = root.current?.querySelector<SVGPolylineElement>(
          ".memo-exhibit__line"
        );
        if (line && typeof line.getTotalLength === "function") {
          const len = line.getTotalLength();
          if (len > 0) {
            tl.from(
              line,
              {
                strokeDasharray: len,
                strokeDashoffset: len,
                duration: 0.7,
                ease: "none",
              },
              1.1
            );
          }
        }

        // The declassification swipe: the shutter uncovers the record.
        tl.fromTo(
          ".memo-exhibit__shutter",
          { xPercent: 0 },
          { xPercent: 101, duration: 0.75, ease: "power2.inOut" },
          1.05
        );

        tl.from(
          ".memo-flag",
          { y: -6, opacity: 0, duration: 0.25, stagger: 0.06 },
          1.6
        );

        return () => {
          tl.kill();
          typed.forEach(({ el, full }) => {
            el.textContent = full;
          });
        };
      });

      return () => mm.revert();
    },
    { scope: root, dependencies: [ready] }
  );

  return (
    <section ref={root} className="fh">
      <div className="fh__col">
        <div className="fh-eyebrow eyebrow">
          Findings · {sku} · {windowLabel}
        </div>

        <h1 className="fh-statement serif">
          The file is public.
          <br />
          <em>The cause is not.</em>
        </h1>

        <p className="fh-lede">
          Every observable lead closes. What remains is the finding.
        </p>

        <div className="fh-actions">
          <Link className="btn" href="/basis">
            See the decomposition →
          </Link>
          <Link className="btn ghost" href="/methodology">
            Methodology
          </Link>
        </div>

        <div className="fh-claim">
          <ShowMeHow
            label={`Precise claim${trainedDate ? `, as of ${trainedDate}` : ""}`}
          >
            <p>
              Even a 45-feature ML model can&rsquo;t close the unexplained gap
              out-of-sample{trainedDate ? ` (as of ${trainedDate})` : ""};{" "}
              {icc === null ? "a persistent share" : iccQualifier(icc)} of what
              remains is persistent host identity
              {icc === null ? "" : ` (ICC ${icc.toFixed(2)})`}.
            </p>
            <p>
              Unexplained share in market-priced segments has ranged ~20–61%
              across recent weeks — basis risk is segment- and
              time-conditional.
            </p>
            <p>
              The gap compares the 45-feature model&rsquo;s honest
              out-of-sample fit against the four simple factors&rsquo;
              in-sample share — one picture, not two separate confirmations.
              Both anchors are dated structural claims from the published
              artifact; inspect them on the{" "}
              <Link href="/explainability">explainability page</Link>.
            </p>
          </ShowMeHow>
        </div>
      </div>

      <div className="fh__memo">
        <FindingMemo
          facts={{
            sku,
            anovaPct,
            gapPp,
            icc,
            todayPct,
            trainedDate,
            points,
          }}
        />
      </div>
    </section>
  );
}

export function FindingsHero() {
  return (
    <Suspense
      fallback={
        <section className="fh">
          <p className="caption">Loading…</p>
        </section>
      }
    >
      <FindingsHeroInner />
    </Suspense>
  );
}
