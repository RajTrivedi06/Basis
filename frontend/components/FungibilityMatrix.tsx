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

/**
 * Rows per page. 32 keeps today's ~96 canonical SKUs at three page links
 * (the ruled "two to three"); the control renders however many pages the
 * live count actually needs.
 */
const PAGE_SIZE = 32;

export function FungibilityMatrix() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["fungibility-matrix"],
    queryFn: () => getFungibilityMatrix(),
  });

  const [sortKey, setSortKey] = useState<SortKey>("pct_residual");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const sorted = useMemo(
    () => (data ? sortRows(data.items, sortKey, sortDir) : []),
    [data, sortKey, sortDir]
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(
    clampedPage * PAGE_SIZE,
    (clampedPage + 1) * PAGE_SIZE
  );

  const header = (
    <header style={{ marginBottom: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        Fungibility matrix
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
    setPage(0);
  };

  const showingFrom = clampedPage * PAGE_SIZE + 1;
  const showingTo = Math.min(sorted.length, (clampedPage + 1) * PAGE_SIZE);

  return (
    <section>
      {header}

      {/* Mobile sort control (the table's sortable headers are hidden
          with the table below 720px) — reference: Dashboard Mobile. */}
      <span className="fung-sort">
        <select
          aria-label="Sort SKUs"
          value={sortKey}
          onChange={(e) => {
            const key = e.target.value as SortKey;
            setSortKey(key);
            setSortDir(key === "gpu_sku" ? "asc" : "desc");
            setPage(0);
          }}
        >
          <option value="pct_residual">Sort · residual</option>
          <option value="observation_count">Sort · offers</option>
          <option value="median_price">Sort · median $/hr</option>
          <option value="gpu_sku">Sort · SKU name</option>
        </select>
        <span aria-hidden className="fung-sort__chev">
          ▼
        </span>
      </span>

      {/* Card view — reference treatment from Basis Dashboard Mobile */}
      <div className="fung-cards">
        {pageRows.map((row) => (
          <SkuCard key={row.gpu_sku} row={row} />
        ))}
      </div>

      <div className="panel fung-table" style={{ overflow: "hidden" }}>
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
              {pageRows.map((row) => (
                <MatrixRow key={row.gpu_sku} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <nav className="fung-pages" aria-label="SKU table pages">
        <span className="mono fung-pages__showing">
          Showing {showingFrom}–{showingTo} of {sorted.length} canonical SKUs
        </span>
        {pageCount > 1 && (
          <span className="fung-pages__links">
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                type="button"
                className="fung-pages__link mono"
                aria-current={i === clampedPage ? "page" : undefined}
                onClick={() => setPage(i)}
              >
                {i + 1}
              </button>
            ))}
          </span>
        )}
      </nav>
    </section>
  );
}

function SkuCard({ row }: { row: FungibilityMatrixRow }) {
  const family = gpuFamily(row.gpu_sku);
  return (
    <div className="fung-card panel">
      <div className="fung-card__head">
        <span className="mono fung-card__sku">{row.gpu_sku}</span>
        {family && <span className="badge">{family}</span>}
      </div>
      <div className="mono fung-card__meta">
        <span>{row.observation_count.toLocaleString()} offers</span>
        <span>{row.provider_count} prov</span>
        <span className="fung-card__med">
          ${row.median_price.toFixed(2)}/hr
        </span>
      </div>
      {row.pct_residual === null ? (
        <div className="serif fung-card__accum">accumulating observations</div>
      ) : (
        <div className="fung-card__res">
          <span className="fung-card__track">
            <span
              className="fung-card__fill"
              style={{
                width: `${Math.max(0, Math.min(100, row.pct_residual))}%`,
              }}
            />
          </span>
          <span className="mono fung-card__pct">
            {row.pct_residual.toFixed(0)}%
          </span>
        </div>
      )}
    </div>
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
