import Link from "next/link";
import { FungibilityMatrix } from "@/components/FungibilityMatrix";

export default function FindingsPage() {
  return (
    <div className="space-y-12">
      <section>
        <p className="text-sm uppercase tracking-wide text-gray-500">Basis · Findings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          How fungible is GPU compute?
        </h1>
        <p className="mt-2 text-gray-400">
          Measuring basis risk in quoted GPU prices across four providers.
        </p>
      </section>

      <section>
        <FungibilityMatrix />
        <p className="mt-3 max-w-3xl text-sm text-gray-400">
          One row per canonical SKU. <span className="text-gray-300">% Residual</span>{" "}
          is the share of log-price variance that remains after attributing to region,
          commitment type, provider, and bundle — the basis risk any compute
          benchmark or derivatives product would have to live with. SKUs with
          fewer than 5 offers on the latest day show as{" "}
          <span className="text-gray-300">accumulating</span>.
        </p>
      </section>

      <section className="max-w-3xl space-y-4 text-gray-300">
        <p>
          On 2026-04-17, an NVIDIA H100 SXM 80GB rented for{" "}
          <span className="font-mono text-gray-100">$0.45/hour</span> on the
          cheapest Vast.ai listing and{" "}
          <span className="font-mono text-gray-100">$6.88/hour</span> on the
          most expensive AWS Spot availability zone. Same nominal hardware,{" "}
          <span className="text-gray-100">15× spread</span>, same day.
        </p>
        <p>
          Conventional wisdom attributes most of that spread to the obvious
          stuff — region, commitment type, who's selling it. Basis is a
          public-data study that collects quoted prices twice daily from four
          providers and decomposes the cross-sectional variance into observable
          factors and a residual. The matrix above is the current snapshot of
          that decomposition across every canonical SKU we observe.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          href="/dispersion"
          title="Dispersion"
          sub="How prices spread day over day"
        />
        <Card
          href="/basis"
          title="Decomposition"
          sub="Where the variance goes"
        />
        <Card
          href="/providers"
          title="Providers"
          sub="Who runs above vs below market"
        />
        <Card
          href="/methodology"
          title="Methodology"
          sub="Data, normalization, math, caveats"
        />
      </section>

      <section className="max-w-3xl text-sm text-gray-400">
        <h2 className="text-base font-medium text-gray-200">Caveats</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <span className="text-gray-200">Short sample.</span> The cron has
            been running since 2026-04-17 and continues to collect. Residuals
            will move as data accumulates; expect the range to narrow over the
            next few weeks.
          </li>
          <li>
            <span className="text-gray-200">Quoted, not transacted.</span>{" "}
            Enterprise transaction prices likely compress dispersion. Gated
            benchmarks like Ornn's OCPI measure the other side of this gap.
          </li>
          <li>
            <span className="text-gray-200">Four providers, not twenty.</span>{" "}
            OCI, GCP, Azure, CoreWeave, Crusoe, and others are missing.
          </li>
          <li>
            <span className="text-gray-200">Conservative normalization.</span>{" "}
            Reliability, interconnect type, and datacenter tier are
            deliberately left in the residual — normalizing them would be
            pretending to measure what we can't.
          </li>
        </ul>
      </section>

      <section className="max-w-3xl text-sm text-gray-500">
        For the full writeup see{" "}
        <Link href="/methodology" className="text-gray-300 underline">
          Methodology
        </Link>
        . Code is in{" "}
        <a
          href="https://github.com/rstrivedi2/Basis"
          className="text-gray-300 underline"
        >
          the repo
        </a>
        .
      </section>
    </div>
  );
}

function Card({
  href,
  title,
  sub,
}: {
  href: string;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-md border border-gray-800 bg-gray-900/40 p-4 transition-colors hover:border-gray-700 hover:bg-gray-900/70"
    >
      <div className="text-sm font-medium text-gray-100 group-hover:text-white">
        {title}
      </div>
      <div className="mt-1 text-xs text-gray-500">{sub}</div>
    </Link>
  );
}
