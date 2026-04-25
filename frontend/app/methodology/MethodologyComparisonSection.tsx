"use client";

import { useQuery } from "@tanstack/react-query";
import { DecompBar, type DecompShares } from "@/components/charts/DecompBar";
import { getBasisDecomposition } from "@/lib/api";
import { factorColor, type Factor } from "@/lib/factorColor";
import { useSku } from "@/lib/useSku";
import type { BasisDecompositionResponse } from "@/lib/types";

const SEGMENTS: { key: Factor; label: string }[] = [
  { key: "region", label: "Region" },
  { key: "commitment", label: "Commitment" },
  { key: "provider", label: "Provider" },
  { key: "bundle", label: "Bundle" },
  { key: "residual", label: "Residual" },
];

export function MethodologyComparisonSection() {
  const { sku } = useSku();
  const basisQuery = useQuery({
    queryKey: ["methodology-comparison", sku],
    queryFn: () => getBasisDecomposition(sku),
  });

  const message = getBasisMessage(basisQuery.error);

  return (
    <section className="pt-14">
      <div className="sec-eyebrow">
        <span className="num">06</span>
        <h2>Compare to an equal-weight donut</h2>
      </div>
      <p className="caption mb-5 max-w-[780px]">
        Same current decomposition, two geometries. Both panels below keep the
        model order{" "}
        <span className="mono text-[var(--ink)]">
          region → commitment → provider → bundle → residual
        </span>
        ; only the visual framing changes.
      </p>

      {basisQuery.isLoading ? (
        <ComparisonState
          title="Loading comparison…"
          body="Fetching the latest basis decomposition for the current SKU."
        />
      ) : basisQuery.isError ? (
        <ComparisonState
          title={
            message.tone === "muted"
              ? "No decomposition available."
              : "Failed to load comparison."
          }
          body={message.message}
          tone={message.tone}
        />
      ) : !basisQuery.data ? (
        <ComparisonState
          title="No decomposition available."
          body="The comparison needs a latest basis decomposition for the current URL SKU."
        />
      ) : (
        <ComparisonPanels
          sku={sku}
          decomposition={basisQuery.data}
        />
      )}
    </section>
  );
}

function ComparisonPanels({
  sku,
  decomposition,
}: {
  sku: string;
  decomposition: BasisDecompositionResponse;
}) {
  const shares = toDecompShares(decomposition);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="panel p-[22px]">
        <div className="eyebrow mb-3.5">v1 · donut framing</div>
        <div className="flex justify-center">
          <DonutComparison shares={shares} />
        </div>
        <ComparisonLegend shares={shares} />
        <p className="caption mt-4 leading-relaxed">
          The donut uses the same latest decomposition for{" "}
          <span className="mono text-[var(--ink)]">{sku}</span>, but the shape
          makes residual read like just another slice.
        </p>
      </div>

      <div className="panel p-[22px]">
        <div className="eyebrow mb-3.5">
          v2 · residual-first bar · {decomposition.date}
        </div>
        <DecompBar decomp={shares} height={72} showLabels={false} />
        <p className="caption mt-4 leading-relaxed">
          The stacked bar keeps the sequential model order visible and gives
          the residual the dominant footprint proportional to its share of
          total variance.
        </p>
      </div>
    </div>
  );
}

function DonutComparison({ shares }: { shares: DecompShares }) {
  const total = SEGMENTS.reduce((sum, segment) => sum + shares[segment.key], 0);
  const outerRadius = 88;
  const innerRadius = 46;
  const cx = 120;
  const cy = 120;

  let angle = -Math.PI / 2;
  const arcs = SEGMENTS.map((segment) => {
    const portion = total > 0 ? shares[segment.key] / total : 0;
    const start = angle;
    const end = angle + portion * Math.PI * 2;
    angle = end;
    const x0 = cx + outerRadius * Math.cos(start);
    const y0 = cy + outerRadius * Math.sin(start);
    const x1 = cx + outerRadius * Math.cos(end);
    const y1 = cy + outerRadius * Math.sin(end);
    const largeArc = portion > 0.5 ? 1 : 0;

    return {
      key: segment.key,
      label: segment.label,
      d: `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
    };
  });

  return (
    <svg
      width="240"
      height="240"
      viewBox="0 0 240 240"
      role="img"
      aria-label="Illustrative donut view of the same decomposition"
    >
      {arcs.map((arc) => (
        <path
          key={arc.key}
          d={arc.d}
          fill={factorColor(arc.key)}
          stroke="var(--panel-lo)"
          strokeWidth="1.5"
        />
      ))}
      <circle cx={cx} cy={cy} r={innerRadius} fill="var(--panel-lo)" />
    </svg>
  );
}

function ComparisonLegend({ shares }: { shares: DecompShares }) {
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
      {SEGMENTS.map((segment) => (
        <div key={segment.key} className="flex items-center gap-2">
          <span
            style={{
              width: segment.key === "residual" ? 10 : 8,
              height: segment.key === "residual" ? 10 : 8,
              borderRadius: 1,
              background: factorColor(segment.key),
            }}
          />
          <span
            className="caption"
            style={
              segment.key === "residual"
                ? { color: "var(--residual)" }
                : undefined
            }
          >
            {segment.label}
          </span>
          <span
            className="mono text-[11px]"
            style={
              segment.key === "residual"
                ? { color: "var(--residual)" }
                : { color: "var(--ink)" }
            }
          >
            {(shares[segment.key] * 100).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function ComparisonState({
  title,
  body,
  tone = "muted",
}: {
  title: string;
  body: string;
  tone?: "muted" | "error";
}) {
  return (
    <div className="panel p-[22px]">
      <div
        className="mono text-[12px] uppercase tracking-[0.1em]"
        style={{
          color: tone === "error" ? "var(--verdict-bad)" : "var(--ink-mid)",
        }}
      >
        {title}
      </div>
      <p className="caption mb-0 mt-3 max-w-[720px] leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function toDecompShares(data: BasisDecompositionResponse): DecompShares {
  const total = data.total_variance || 1;
  return {
    region: safeShare(data.variance_from_region, total),
    commitment: safeShare(data.variance_from_commitment, total),
    provider: safeShare(data.variance_from_provider, total),
    bundle: safeShare(data.variance_from_bundle, total),
    residual: safeShare(data.residual_variance, total),
  };
}

function safeShare(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return Math.max(0, value / total);
}

function getBasisMessage(error: unknown): {
  tone: "muted" | "error";
  message: string;
} {
  const message = (error as Error | undefined)?.message ?? "";
  if (message.startsWith("API 404")) {
    return {
      tone: "muted",
      message:
        "Not enough data yet to compare the current SKU. The methodology comparison needs a latest daily decomposition row.",
    };
  }
  if (message) {
    return {
      tone: "error",
      message,
    };
  }
  return {
    tone: "muted",
    message: "No decomposition is available for the current URL SKU.",
  };
}
