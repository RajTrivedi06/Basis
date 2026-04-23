"use client";

import { SkuPicker } from "@/components/SkuPicker";
import { useSku } from "@/lib/useSku";
import { DispersionChart } from "./DispersionChart";

export function DispersionPageClient() {
  const { sku, setSku } = useSku();

  return (
    <div className="page-wide fade-up">
      <section className="pb-2.5 pt-9">
        <div className="eyebrow mb-2.5">02 · Dispersion</div>
        <h1 className="display m-0 text-[clamp(2rem,5vw,2.75rem)] font-normal leading-[1.1] tracking-[-0.02em] text-[var(--ink-hi)]">
          <span className="mono text-[0.92em]">{sku}</span> price,{" "}
          <em className="font-serif not-italic text-[var(--ink-mid)]">
            p25 – median – p75
          </em>
        </h1>
        <p className="caption mt-2.5 max-w-[620px]">
          Interquartile band and median per collection day. Wider bands mean
          more same-day price disagreement across providers for this SKU.
        </p>
      </section>

      <section className="pt-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="caption mono uppercase tracking-[0.1em]">
            GPU SKU
          </span>
          <SkuPicker value={sku} onChange={setSku} />
        </div>

        <div className="panel px-2.5 pb-2 pt-[18px]">
          <DispersionChart gpuSku={sku} />
        </div>
      </section>

      <div className="sec-eyebrow max-w-3xl">
        <span className="num">03</span>
        <h2>How to read this chart</h2>
      </div>
      <div className="caption max-w-3xl space-y-2 leading-relaxed">
        <p>
          <span className="text-[var(--ink)]">Median</span> is the middle quoted
          price across all offers that day.
        </p>
        <p>
          The shaded band spans the{" "}
          <span className="text-[var(--ink)]">25th to 75th percentile</span>{" "}
          (interquartile range): half of observed quotes fall inside the band
          for that day.
        </p>
        <p>
          The line tracks the median through time. Use the SKU control to
          compare models; dense SKUs like H100 SXM usually show a tighter band
          than thinly traded ones.
        </p>
      </div>
    </div>
  );
}
