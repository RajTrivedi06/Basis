"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { getDecompositionObservations } from "@/lib/api";
import { providerLabel } from "@/lib/providerLabel";
import type { DecompositionObservation } from "@/lib/types";

type SortKey = "price-asc" | "price-desc" | "provider";

export function BasisObservationsDrawer({
  gpuSku,
  date,
  open,
  suspendEscape = false,
  onClose,
  onInspect,
}: {
  gpuSku: string;
  date: string | null;
  open: boolean;
  suspendEscape?: boolean;
  onClose: () => void;
  onInspect: (rawObservationId: number) => void;
}) {
  const observationsQuery = useQuery({
    queryKey: ["basis-drawer-observations", gpuSku, date],
    queryFn: () =>
      getDecompositionObservations(gpuSku, date ? { date } : undefined),
    enabled: open && !!date,
  });

  const [mounted, setMounted] = useState(false);
  const [domReady, setDomReady] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("price-asc");

  useEffect(() => {
    setDomReady(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [open]);

  useEffect(() => {
    if (!open || suspendEscape) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, suspendEscape]);

  const items = observationsQuery.data?.items ?? null;
  const itemCount = items?.length ?? null;

  const sortedItems = useMemo(() => {
    if (!items) return null;
    const copy = [...items];
    switch (sortKey) {
      case "price-asc":
        return copy.sort(
          (a, b) => a.price_usd_per_hour - b.price_usd_per_hour,
        );
      case "price-desc":
        return copy.sort(
          (a, b) => b.price_usd_per_hour - a.price_usd_per_hour,
        );
      case "provider":
        return copy.sort((a, b) =>
          providerLabel(a.provider).localeCompare(providerLabel(b.provider)),
        );
      default:
        return copy;
    }
  }, [items, sortKey]);

  const priceStats = useMemo(() => {
    if (!items || items.length === 0) return null;
    const prices = items.map((o) => o.price_usd_per_hour);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [items]);

  if (!open || !domReady) return null;

  const drawer = (
    <>
      <div
        className="fixed inset-0 z-40 bg-[rgba(31,29,26,0.35)] transition-opacity duration-200"
        style={{ opacity: mounted ? 1 : 0 }}
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Observations contributing to ${gpuSku}`}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[840px] flex-col border-l border-[var(--line-hi)] bg-[var(--bg)] shadow-2xl"
        style={{
          transform: mounted ? "translateX(0)" : "translateX(16px)",
          opacity: mounted ? 1 : 0,
          transition:
            "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease",
        }}
      >
        <header className="border-b border-[var(--line-lo)] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="eyebrow mb-1.5">Canonical offers</div>
              <h2 className="serif m-0 text-[22px] font-normal text-[var(--ink-hi)]">
                Contributing observations
              </h2>
              <div className="caption mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Latest decomposition for</span>
                <span className="mono text-[var(--ink)]">{gpuSku}</span>
                {date && (
                  <>
                    <span className="text-[var(--ink-faint)]">·</span>
                    <span className="mono text-[var(--ink-mid)]">{date}</span>
                  </>
                )}
                {itemCount !== null && (
                  <>
                    <span className="text-[var(--ink-faint)]">·</span>
                    <span className="mono text-[var(--ink-mid)]">
                      {itemCount.toLocaleString()}{" "}
                      {itemCount === 1 ? "offer" : "offers"}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              className="btn ghost shrink-0"
              onClick={onClose}
              aria-label="Close drawer"
            >
              Close
            </button>
          </div>

          {sortedItems && sortedItems.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className="mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-dim)]"
              >
                Sort by
              </span>
              <SortChip
                active={sortKey === "price-asc"}
                onClick={() => setSortKey("price-asc")}
              >
                Price ↑
              </SortChip>
              <SortChip
                active={sortKey === "price-desc"}
                onClick={() => setSortKey("price-desc")}
              >
                Price ↓
              </SortChip>
              <SortChip
                active={sortKey === "provider"}
                onClick={() => setSortKey("provider")}
              >
                Provider A → Z
              </SortChip>
            </div>
          )}
        </header>

        <div
          className="flex-1 overflow-y-auto"
          style={{ minHeight: 0 }}
        >
          {!date ? (
            <DrawerState
              title="No decomposition date available."
              body="The latest basis decomposition has not loaded yet, so there is no contributing-offer slice to inspect."
            />
          ) : observationsQuery.isLoading ? (
            <DrawerState
              title="Loading contributing observations…"
              body="Fetching the canonical offers that fed the current daily decomposition."
            />
          ) : observationsQuery.isError ? (
            <DrawerState
              title="Failed to load contributing observations."
              body={(observationsQuery.error as Error)?.message ?? "unknown error"}
              tone="error"
            />
          ) : !sortedItems || sortedItems.length === 0 ? (
            <DrawerState
              title="No contributing offers found."
              body="This SKU has a decomposition row, but the contributing-offer endpoint returned no canonical offers for the selected date."
            />
          ) : (
            <ul
              className="m-0 grid list-none gap-2.5 p-6"
              role="list"
              aria-label="Contributing canonical offers"
            >
              {sortedItems.map((observation) => (
                <li key={observation.canonical_offer_id} className="m-0">
                  <ObservationCard
                    observation={observation}
                    priceMin={priceStats?.min ?? null}
                    priceMax={priceStats?.max ?? null}
                    onInspect={onInspect}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );

  return createPortal(drawer, document.body);
}

function SortChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip${active ? " on" : ""}`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function ObservationCard({
  observation,
  priceMin,
  priceMax,
  onInspect,
}: {
  observation: DecompositionObservation;
  priceMin: number | null;
  priceMax: number | null;
  onInspect: (rawObservationId: number) => void;
}) {
  const isMin =
    priceMin !== null && observation.price_usd_per_hour === priceMin;
  const isMax =
    priceMax !== null && observation.price_usd_per_hour === priceMax;

  return (
    <article className="obs-card">
      <header className="obs-card-head">
        <div className="obs-identity">
          <span className="obs-provider">
            {providerLabel(observation.provider)}
          </span>
          <span className="obs-commitment-pill">
            {observation.commitment_type}
          </span>
        </div>

        <div className="obs-price">
          <span className="num obs-price-value">
            ${observation.price_usd_per_hour.toFixed(4)}
          </span>
          <span className="obs-price-unit">/ GPU hr</span>
          {isMin && <span className="obs-price-flag low">low</span>}
          {isMax && <span className="obs-price-flag high">high</span>}
        </div>
      </header>

      <dl className="obs-meta">
        <ObsMetaRow label="Region">
          <RegionValue observation={observation} />
        </ObsMetaRow>
        <ObsMetaRow label="Bundle">
          <BundleValue observation={observation} />
        </ObsMetaRow>
      </dl>

      <footer className="obs-card-foot">
        <span className="mono text-[11px] text-[var(--ink-dim)]">
          raw observation{" "}
          <span className="text-[var(--ink-mid)]">
            #{observation.raw_observation_id}
          </span>
        </span>
        <button
          type="button"
          className="btn ghost"
          onClick={() => onInspect(observation.raw_observation_id)}
          aria-label={`Inspect raw observation #${observation.raw_observation_id} from ${providerLabel(observation.provider)}`}
        >
          Inspect provenance →
        </button>
      </footer>
    </article>
  );
}

function ObsMetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="obs-meta-row">
      <dt className="obs-meta-label">{label}</dt>
      <dd className="obs-meta-value">{children}</dd>
    </div>
  );
}

function RegionValue({
  observation,
}: {
  observation: DecompositionObservation;
}) {
  const parts: string[] = [];
  if (observation.region_country) parts.push(observation.region_country);
  if (observation.region_state) parts.push(observation.region_state);
  if (observation.region_city) parts.push(observation.region_city);

  if (parts.length === 0) {
    return <span className="pill-unknown">UNKNOWN</span>;
  }

  return (
    <span className="mono text-[12px] text-[var(--ink)]">
      {parts.join(" · ")}
    </span>
  );
}

function BundleValue({
  observation,
}: {
  observation: DecompositionObservation;
}) {
  const items: string[] = [];
  if (observation.vcpus_bundled != null) {
    items.push(`${observation.vcpus_bundled} vCPU`);
  }
  if (observation.ram_gb_bundled != null) {
    items.push(`${observation.ram_gb_bundled} GB RAM`);
  }
  if (observation.storage_gb_bundled != null) {
    items.push(`${Math.round(observation.storage_gb_bundled)} GB disk`);
  }
  if (observation.verification_tier) {
    items.push(observation.verification_tier);
  }

  if (items.length === 0) {
    return <span className="pill-unknown">UNKNOWN</span>;
  }

  return (
    <span className="text-[12px] text-[var(--ink)]">{items.join(" · ")}</span>
  );
}

function DrawerState({
  title,
  body,
  tone = "muted",
}: {
  title: string;
  body: string;
  tone?: "muted" | "error";
}) {
  return (
    <div className="p-6">
      <div className="panel p-[18px]">
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
    </div>
  );
}
