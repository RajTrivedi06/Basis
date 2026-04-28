"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFungibilityMatrix } from "@/lib/api";
import { gpuFamily } from "@/lib/gpuFamily";
import type { FungibilityMatrixRow } from "@/lib/types";

type SortKey =
  | "gpu_sku"
  | "median_price"
  | "pct_residual"
  | "observation_count"
  | "provider_count";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "gpu_sku", label: "SKU", align: "left" },
  { key: "observation_count", label: "Offers", align: "right" },
  { key: "provider_count", label: "Providers", align: "right" },
  { key: "median_price", label: "Median $/hr", align: "right" },
  { key: "pct_residual", label: "Residual", align: "right" },
];

export function FungibilityMatrix() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["fungibility-matrix"],
    queryFn: () => getFungibilityMatrix(),
  });

  const [sortKey, setSortKey] = useState<SortKey>("pct_residual");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(
    () => (data ? sortRows(data.items, sortKey, sortDir) : []),
    [data, sortKey, sortDir]
  );

  const header = (
    <header style={{ marginBottom: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        01 · Fungibility matrix
      </div>
      <h2
        className="serif"
        style={{
          fontSize: 28,
          fontWeight: 400,
          margin: 0,
          letterSpacing: "-0.01em",
          color: "var(--ink-hi)",
        }}
      >
        How interchangeable is each SKU?
      </h2>
      <p className="caption" style={{ marginTop: 6, maxWidth: 620 }}>
        A low residual means the market agrees on price given observable
        features. A high residual means it doesn&apos;t — and the SKU is a poor
        benchmark target.
      </p>
    </header>
  );

  if (isLoading) {
    return (
      <section>
        {header}
        <Placeholder message="Loading fungibility matrix…" />
      </section>
    );
  }
  if (isError) {
    return (
      <section>
        {header}
        <Placeholder
          message={`Failed to load: ${
            (error as Error)?.message ?? "unknown error"
          }`}
          tone="error"
        />
      </section>
    );
  }
  if (!data || data.items.length === 0) {
    return (
      <section>
        {header}
        <Placeholder message="No canonical SKUs observed yet." />
      </section>
    );
  }

  const toggle = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "gpu_sku" ? "asc" : "desc");
    }
  };

  return (
    <section>
      {header}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    style={{ textAlign: c.align }}
                    aria-sort={
                      sortKey === c.key
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className="inline-flex items-center gap-1"
                      style={{
                        color:
                          c.key === "pct_residual"
                            ? "var(--residual)"
                            : "inherit",
                      }}
                    >
                      {c.label}
                      <SortIndicator
                        active={sortKey === c.key}
                        dir={sortDir}
                      />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <MatrixRow key={row.gpu_sku} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function MatrixRow({ row }: { row: FungibilityMatrixRow }) {
  const family = gpuFamily(row.gpu_sku);
  return (
    <tr>
      <td>
        <div className="flex items-baseline" style={{ gap: 10 }}>
          <span
            className="mono"
            style={{ fontSize: 12, color: "var(--ink-hi)" }}
          >
            {row.gpu_sku}
          </span>
          {family && <span className="badge">{family}</span>}
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10,
            color: "var(--ink-dim)",
            marginTop: 2,
            letterSpacing: "0.02em",
          }}
        >
          latest · {row.latest_date}
        </div>
      </td>
      <td
        className="num"
        style={{ textAlign: "right", color: "var(--ink)" }}
      >
        {row.observation_count.toLocaleString()}
      </td>
      <td
        className="num"
        style={{ textAlign: "right", color: "var(--ink-mid)" }}
      >
        {row.provider_count}
      </td>
      <td
        className="num"
        style={{ textAlign: "right", color: "var(--ink)" }}
      >
        ${row.median_price.toFixed(2)}
      </td>
      <td style={{ textAlign: "right" }}>
        {row.pct_residual === null ? (
          <span className="pill-unknown">accumulating</span>
        ) : (
          <ResidualCell v={row.pct_residual} />
        )}
      </td>
    </tr>
  );
}

function ResidualCell({ v }: { v: number }) {
  const pct = Math.max(0, Math.min(100, v));
  return (
    <span
      className="inline-flex items-center"
      style={{ gap: 8, minWidth: 96 }}
    >
      <span
        style={{
          width: 54,
          height: 6,
          background: "var(--panel-hi)",
          borderRadius: 1,
          overflow: "hidden",
          display: "inline-block",
        }}
      >
        <span
          style={{
            display: "block",
            height: "100%",
            width: `${pct}%`,
            background: "var(--residual)",
          }}
        />
      </span>
      <span
        className="mono"
        style={{ fontSize: 12, color: "var(--residual)" }}
      >
        {v.toFixed(0)}%
      </span>
    </span>
  );
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <span className="mono" style={{ color: "var(--ink-faint)" }}>
        ↕
      </span>
    );
  }
  return (
    <span className="mono" style={{ color: "var(--ink-mid)" }}>
      {dir === "asc" ? "↑" : "↓"}
    </span>
  );
}

function Placeholder({
  message,
  tone = "muted",
}: {
  message: string;
  tone?: "muted" | "error";
}) {
  return (
    <div
      className="panel caption flex h-48 items-center justify-center"
      style={{
        color: tone === "error" ? "var(--verdict-bad)" : "var(--ink-dim)",
      }}
    >
      {message}
    </div>
  );
}

function sortRows(
  rows: FungibilityMatrixRow[],
  key: SortKey,
  dir: SortDir
): FungibilityMatrixRow[] {
  const mult = dir === "asc" ? 1 : -1;
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (av < bv) return -1 * mult;
    if (av > bv) return 1 * mult;
    return 0;
  });
  return copy;
}
