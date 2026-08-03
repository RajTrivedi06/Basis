"use client";

import { useQuery } from "@tanstack/react-query";
import { SkuPicker } from "@/components/SkuPicker";
import { ShowMeHow } from "@/components/disclosure/TwoLayer";
import { GlossaryTerm } from "@/components/glossary/GlossaryTerm";
import { getDispersion } from "@/lib/api";
import { useSku } from "@/lib/useSku";
import type { DispersionPoint } from "@/lib/types";
import { DispersionChart } from "./DispersionChart";

export function DispersionPageClient() {
  const { sku, setSku } = useSku();

  return (
    <div className="page-wide fade-up">
      <div className="int-head">
        <div className="int-head__eyebrow">
          <span className="num">02</span>
          <span>Raw price spread</span>
        </div>
        <h1 className="int-head__title">
          <span className="mono text-[0.78em]">{sku}</span>{" "}
          <em>p25 – median – p75</em>
        </h1>
        <p className="int-head__lede">
          Wider bands mean more same-day price disagreement across providers for
          this SKU.
        </p>
      </div>

      <div className="int-controls">
        <div className="int-controls__group">
          <span className="int-controls__label">Canonical GPU SKU</span>
          <SkuPicker value={sku} onChange={setSku} />
        </div>
        <DispersionMeta gpuSku={sku} />
      </div>

      <div className="panel px-2.5 pb-2 pt-[18px]">
        <DispersionChart gpuSku={sku} />
      </div>

      <section className="int-section">
        <div className="int-section__head">
          <span className="int-section__num">03</span>
          <h2 className="int-section__title">How to read this chart</h2>
        </div>

        <div className="int-notes int-notes--three" style={{ borderTop: 0, paddingTop: 0, marginTop: 0 }}>
          <p>
            <strong>Median.</strong> The middle quoted price each day — robust
            to a single extreme listing in either direction.
          </p>
          <p>
            <strong>Interquartile range.</strong> The shaded band spans the 25th
            to 75th percentile: half of the day&apos;s quotes fall inside it.
          </p>
          <p>
            <strong>Band width.</strong> Densely quoted SKUs tend to form
            tighter bands than thin ones, so compare a SKU with itself over time
            before comparing two SKUs.
          </p>
        </div>

        <div className="mt-7 max-w-[68ch]">
          <ShowMeHow label="Show me how the band is built">
            <p>
              Each day&apos;s offers for this SKU are pooled across every
              provider, then reduced to three numbers: the 25th percentile, the
              median, and the 75th percentile. A day needs at least three offers
              to be plotted at all; thinner days are held out rather than drawn
              with false confidence.
            </p>
            <p>
              Percentiles are used instead of a mean and standard deviation
              because quoted GPU prices are not symmetric — a handful of very
              cheap{" "}
              <GlossaryTerm term="spot">spot</GlossaryTerm> listings or one
              mispriced marketplace row would drag an average somewhere no
              buyer could actually transact.
            </p>
            <p>
              The band is spread, not explanation. It says quotes disagree; it
              does not say why. Naming the causes is the{" "}
              <GlossaryTerm term="decomposition">decomposition</GlossaryTerm>{" "}
              on the Basis page, and what survives it is the{" "}
              <GlossaryTerm term="residual">residual</GlossaryTerm>.
            </p>
          </ShowMeHow>
        </div>
      </section>
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

  if (!data || data.points.length === 0) return <span />;

  const totalObs = data.points.reduce(
    (sum: number, p: DispersionPoint) => sum + p.observation_count,
    0
  );

  return (
    <span className="int-controls__meta">
      {data.points.length} {data.points.length === 1 ? "day" : "days"} ·{" "}
      {totalObs.toLocaleString()} offers
    </span>
  );
}
