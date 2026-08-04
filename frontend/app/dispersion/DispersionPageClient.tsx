"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SkuPicker } from "@/components/SkuPicker";
import { GlossaryTerm } from "@/components/glossary/GlossaryTerm";
import { formatMemoDate } from "@/lib/memoDate";
import { getDispersion } from "@/lib/api";
import { useSku } from "@/lib/useSku";
import type { DispersionPoint } from "@/lib/types";
import { DispersionChart } from "./DispersionChart";

export function DispersionPageClient() {
  const { sku, setSku } = useSku();
  const [howOpen, setHowOpen] = useState(false);
  const howId = useId();

  return (
    <div className="page-wide fade-up disp-page">
      <header className="disp-head">
        <div className="disp-head__row">
          <div className="disp-head__copy">
            <div className="disp-head__eyebrow">02 · Raw price spread</div>
            <h1 className="disp-head__title">
              <span className="disp-head__sku mono">{sku}</span>
              <em>p25 – median – p75</em>
            </h1>
            <p className="disp-head__lede">
              Wider bands mean more same-day price disagreement across providers
              for this SKU. Quoted prices only — no executed trades.
            </p>
          </div>
          <div className="disp-head__meta">
            <div className="disp-head__meta-label">Canonical GPU SKU</div>
            <SkuPicker value={sku} onChange={setSku} className="disp-sku" />
            <DispersionMeta gpuSku={sku} />
          </div>
        </div>
      </header>

      <DispersionChart gpuSku={sku} />

      <section className="disp-guide">
        <div className="disp-guide__head">
          <span className="disp-guide__eyebrow">03 · How to read this chart</span>
          <button
            type="button"
            className="disp-guide__how"
            aria-expanded={howOpen}
            aria-controls={howId}
            onClick={() => setHowOpen((v) => !v)}
          >
            {howOpen ? "−" : "+"} SHOW ME HOW THE BAND IS BUILT
          </button>
        </div>

        <div className="disp-guide__notes">
          <div>
            <h2 className="disp-guide__title">Median</h2>
            <p>
              The middle quoted price of the day — robust to a single extreme
              listing.
            </p>
          </div>
          <div>
            <h2 className="disp-guide__title">Interquartile range</h2>
            <p>
              25th to 75th percentile: half of the day&apos;s quotes fall inside
              the shaded band.
            </p>
          </div>
          <div>
            <h2 className="disp-guide__title">Band width</h2>
            <p>
              Densely quoted SKUs run tighter. Compare a SKU with itself over
              time before comparing two SKUs.
            </p>
          </div>
        </div>

        {howOpen ? (
          <div className="disp-guide__more" id={howId}>
            <p>
              Every provider&apos;s quotes for the day are pooled, then reduced
              to three numbers. A day needs at least three offers or it is held
              out — thinner days are never drawn as confident points.
            </p>
            <p>
              Percentiles instead of mean and standard deviation: quotes are not
              symmetric, and one cheap{" "}
              <GlossaryTerm term="spot">spot</GlossaryTerm> row or one mispriced
              marketplace line would average the price somewhere no buyer could
              actually transact.
            </p>
            <p className="disp-guide__more-span">
              The band is spread, <em>not explanation</em>. Naming the causes is
              the{" "}
              <GlossaryTerm term="decomposition">decomposition</GlossaryTerm>;
              what survives that accounting is the{" "}
              <GlossaryTerm term="residual">residual</GlossaryTerm>.
            </p>
          </div>
        ) : null}
      </section>

      <footer className="disp-sheet-foot">
        <DispersionStamp gpuSku={sku} />
        <Link href="/basis" className="disp-sheet-foot__next">
          Next: which factors absorb the disagreement →
        </Link>
      </footer>
    </div>
  );
}

/**
 * Window summary for the control row. Shares the chart's query key, so
 * React Query serves both from one request.
 */
function DispersionMeta({ gpuSku }: { gpuSku: string }) {
  const { data } = useQuery({
    queryKey: ["dispersion", gpuSku],
    queryFn: () => getDispersion(gpuSku),
  });

  if (!data || data.points.length === 0) return null;

  const totalObs = data.points.reduce(
    (sum: number, p: DispersionPoint) => sum + p.observation_count,
    0
  );

  return (
    <div className="disp-head__meta-value">
      {data.points.length} {data.points.length === 1 ? "day" : "days"} ·{" "}
      {totalObs.toLocaleString()} offers{" "}
      <span className="disp-head__live">LIVE</span>
    </div>
  );
}

function DispersionStamp({ gpuSku }: { gpuSku: string }) {
  const { data } = useQuery({
    queryKey: ["dispersion", gpuSku],
    queryFn: () => getDispersion(gpuSku),
  });

  const latest = data?.points.length
    ? data.points[data.points.length - 1].date
    : null;
  const stamp = formatMemoDate(latest);

  return (
    <span className="disp-sheet-foot__stamp">
      SHEET 02 OF 06 · PLOTTED <em className="serif">Basis</em>
      {stamp !== "—" ? ` · ${stamp}` : null}
    </span>
  );
}
