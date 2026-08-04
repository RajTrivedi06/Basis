"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { getFungibilityMatrix } from "@/lib/api";
import { gpuFamily } from "@/lib/gpuFamily";
import type { FungibilityMatrixRow } from "@/lib/types";

gsap.registerPlugin(useGSAP, ScrollTrigger);

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
 * Rows per sheet. 32 keeps today's ~95 canonical SKUs at three sheets; the
 * control renders however many sheets the live count needs.
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
  const root = useRef<HTMLElement | null>(null);

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
  const ready = !isLoading && !isError && sorted.length > 0;

  // Entries are written into the register as they scroll into view.
  // Batched, so 32 rows share a few ScrollTriggers instead of one each.
  useGSAP(
    () => {
      if (!ready) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const batches = ScrollTrigger.batch("[data-entry]", {
          start: "top 92%",
          once: true,
          batchMax: 10,
          interval: 0.08,
          onEnter: (targets) =>
            gsap.from(targets, {
              opacity: 0,
              y: 8,
              duration: 0.35,
              stagger: 0.045,
              ease: "power2.out",
              overwrite: true,
            }),
        });
        // Row heights settle only after live data lands; without a refresh
        // the later sheets' triggers sit at stale positions.
        ScrollTrigger.refresh();
        return () => batches.forEach((b) => b.kill());
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [ready, clampedPage, sortKey, sortDir] }
  );

  const header = (
    <header className="dossier-head">
      <div className="dossier-band">EXHIBIT B · CANONICAL SKU REGISTER</div>
      <h2 className="dossier-head__title serif">
        How interchangeable is each SKU?
      </h2>
      <p className="dossier-head__lede">
        A low residual means the market agrees on price given observable
        features. A high residual means it doesn&apos;t — and the SKU is a poor
        benchmark target.
      </p>
    </header>
  );

  if (isLoading) {
    return (
      <section className="dossier">
        {header}
        <Placeholder message="RETRIEVING REGISTER…" />
      </section>
    );
  }
  if (isError) {
    return (
      <section className="dossier">
        {header}
        <Placeholder
          message={`REGISTER UNAVAILABLE — ${
            (error as Error)?.message ?? "unknown error"
          }`}
          tone="error"
        />
      </section>
    );
  }
  if (!data || data.items.length === 0) {
    return (
      <section className="dossier">
        {header}
        <Placeholder message="NO CANONICAL SKUS ON RECORD." />
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
    <section className="dossier" ref={root}>
      {header}

      <div className="dossier-sheet">
        <div className="dossier-sheet__tab">
          <span>
            SHEET {clampedPage + 1} OF {pageCount}
          </span>
          <span className="dossier-sheet__filed">
            {sorted.length} SKUS ON RECORD
          </span>
        </div>

        <div className="dossier-controls">
          <span className="dossier-sort">
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
            <span aria-hidden className="dossier-sort__chev">
              ▼
            </span>
          </span>
        </div>

        {/* Card register — small screens */}
        <div className="register-cards">
          {pageRows.map((row) => (
            <SkuCard key={row.gpu_sku} row={row} />
          ))}
        </div>

        {/* Ruled register — wide screens */}
        <div className="register-table">
          <table className="register">
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
                    <button type="button" onClick={() => toggle(c.key)}>
                      {c.label}
                      <SortIndicator active={sortKey === c.key} dir={sortDir} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <MatrixRow
                  key={row.gpu_sku}
                  row={row}
                  n={clampedPage * PAGE_SIZE + i + 1}
                />
              ))}
            </tbody>
          </table>
        </div>

        <nav className="dossier-pages" aria-label="Register sheets">
          <span className="dossier-pages__showing">
            ENTRIES {showingFrom}–{showingTo} OF {sorted.length}
          </span>
          {pageCount > 1 && (
            <span className="dossier-pages__links">
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className="dossier-pages__link"
                  aria-current={i === clampedPage ? "page" : undefined}
                  onClick={() => setPage(i)}
                >
                  {i + 1}
                </button>
              ))}
            </span>
          )}
        </nav>
      </div>
    </section>
  );
}

function SkuCard({ row }: { row: FungibilityMatrixRow }) {
  const family = gpuFamily(row.gpu_sku);
  return (
    <div className="register-card" data-entry>
      <div className="register-card__head">
        <span className="register-card__sku">{row.gpu_sku}</span>
        {family && <span className="stamp-chip">{family}</span>}
      </div>
      <div className="register-card__meta">
        <span>{row.observation_count.toLocaleString()} offers</span>
        <span>{row.provider_count} prov</span>
        <span className="register-card__med">
          ${row.median_price.toFixed(2)}/hr
        </span>
      </div>
      {row.pct_residual === null ? (
        <div className="register__accum">accumulating observations</div>
      ) : (
        <ResidualCell v={row.pct_residual} />
      )}
    </div>
  );
}

function MatrixRow({ row, n }: { row: FungibilityMatrixRow; n: number }) {
  const family = gpuFamily(row.gpu_sku);
  return (
    <tr data-entry>
      <td>
        <span className="register__n">{String(n).padStart(2, "0")}</span>
        <span className="register__sku">{row.gpu_sku}</span>
        {family && <span className="stamp-chip">{family}</span>}
        <span className="register__filed">filed {row.latest_date}</span>
      </td>
      <td className="num" style={{ textAlign: "right" }}>
        {row.observation_count.toLocaleString()}
      </td>
      <td className="num" style={{ textAlign: "right" }}>
        {row.provider_count}
      </td>
      <td className="num" style={{ textAlign: "right" }}>
        ${row.median_price.toFixed(2)}
      </td>
      <td style={{ textAlign: "right" }}>
        {row.pct_residual === null ? (
          <span className="register__accum">accumulating</span>
        ) : (
          <ResidualCell v={row.pct_residual} />
        )}
      </td>
    </tr>
  );
}

/** The unexplained share, redacted — void is its exclusive encoding. */
function ResidualCell({ v }: { v: number }) {
  const pct = Math.max(0, Math.min(100, v));
  return (
    <span className="redaction">
      <span className="redaction__track">
        <span className="redaction__bar" style={{ width: `${pct}%` }} />
      </span>
      <span className="redaction__pct">{v.toFixed(0)}%</span>
    </span>
  );
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="register__caret" aria-hidden="true">
      {!active ? "↕" : dir === "asc" ? "↑" : "↓"}
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
    <div className="dossier-sheet dossier-sheet--empty" data-tone={tone}>
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
