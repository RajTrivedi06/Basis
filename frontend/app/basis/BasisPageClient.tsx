"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type DecompShares } from "@/components/charts/DecompBar";
import { LedgerWaterfall } from "@/components/charts/LedgerWaterfall";
import { SkuPicker } from "@/components/SkuPicker";
import { GlossaryTerm } from "@/components/glossary/GlossaryTerm";
import {
  getBasisDecomposition,
  getDecompositionObservations,
} from "@/lib/api";
import { factorColor, type Factor } from "@/lib/factorColor";
import { formatMemoDate } from "@/lib/memoDate";
import { useSku } from "@/lib/useSku";
import type { BasisDecompositionResponse } from "@/lib/types";
import { BasisObservationsDrawer } from "./BasisObservationsDrawer";
import { BasisRawObservationInspector } from "./BasisRawObservationInspector";
import { BeeswarmReceipt } from "./BeeswarmReceipt";
import { pointsFromObservations } from "./factorPoints";

const SWARM_TABS: { factor: Factor; label: string }[] = [
  { factor: "region", label: "Region" },
  { factor: "commitment", label: "Commitment" },
  { factor: "provider", label: "Provider" },
  { factor: "bundle", label: "Bundle" },
  { factor: "residual", label: "Residual (within cell)" },
];

type FactorKey = Exclude<Factor, "residual">;

type FactorRow = {
  key: Factor;
  label: string;
  share: number;
  /** Remaining unexplained share after this row is credited. */
  balance: number;
  note: string;
};

const FACTOR_META: {
  key: FactorKey;
  label: string;
  note: string;
}[] = [
  {
    key: "region",
    label: "Region",
    note: "Country and locality groupings preserved from the normalized quote.",
  },
  {
    key: "commitment",
    label: "Commitment",
    note: "On-demand, spot, or reserved terms observed on that collection day.",
  },
  {
    key: "provider",
    label: "Provider",
    note: "Identity of the public price source, after region and commitment.",
  },
  {
    key: "bundle",
    label: "Bundle",
    note: "Bundled vCPU, RAM, and storage quartile that traveled with the GPU.",
  },
];

export function BasisPageClient() {
  const { sku, setSku } = useSku();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inspectingId, setInspectingId] = useState<number | null>(null);
  const [swarmFactor, setSwarmFactor] = useState<Factor>("provider");
  const [howOpen, setHowOpen] = useState(false);
  const [openAccount, setOpenAccount] = useState<Factor | null>(null);
  const howId = useId();

  const basisQuery = useQuery({
    queryKey: ["basis", sku],
    queryFn: () => getBasisDecomposition(sku),
  });

  const decomposition = basisQuery.data ?? null;
  const observationsQuery = useQuery({
    queryKey: ["decomposition-observations", sku, decomposition?.date],
    queryFn: () =>
      getDecompositionObservations(
        sku,
        decomposition?.date ? { date: decomposition.date } : undefined
      ),
    enabled: !!decomposition?.date,
  });

  const basisMessage = getBasisMessage(basisQuery.error);
  const basisState =
    basisQuery.isLoading
      ? "loading"
      : basisQuery.isError
        ? basisMessage.tone === "muted"
          ? "empty"
          : "error"
        : !decomposition
          ? "empty"
          : "ready";

  const shares = decomposition ? toDecompShares(decomposition) : null;
  const factorRows = useMemo(
    () => (shares ? buildFactorRows(shares) : []),
    [shares]
  );

  const swarmPoints = useMemo(
    () =>
      pointsFromObservations(swarmFactor, observationsQuery.data?.items ?? []),
    [swarmFactor, observationsQuery.data]
  );

  const stampDate = formatMemoDate(decomposition?.date ?? null);
  const offerCount = observationsQuery.data?.items.length ?? null;

  return (
    <div className="page-wide fade-up settle-page">
      <header className="settle-head">
        <div className="settle-head__row">
          <div className="settle-head__copy">
            <div className="settle-head__eyebrow">03 · Variance settlement</div>
            <h1 className="settle-head__title">
              Four factors take their turn.
              <em> One remainder refuses.</em>
            </h1>
            <p className="settle-head__lede">
              Prices for the same chip disagree. This sheet names the causes we
              can see — where it is, how it is rented, who is renting it, what
              came bundled with it — and measures what is left after all four.
            </p>
          </div>
          <div className="settle-head__meta">
            <div className="settle-head__meta-label">Canonical GPU SKU</div>
            <SkuPicker value={sku} onChange={setSku} className="settle-sku" />
            <div className="settle-head__meta-value">
              {basisQuery.isLoading ? (
                "Loading…"
              ) : decomposition?.date ? (
                <>
                  AS OF {stampDate}
                  {offerCount != null
                    ? ` · ${offerCount.toLocaleString("en-US")} offers`
                    : null}{" "}
                  <span className="settle-head__live">LIVE</span>
                </>
              ) : (
                <>
                  No settlement yet <span className="settle-head__live">—</span>
                </>
              )}
            </div>
            <button
              type="button"
              className="settle-head__how"
              aria-expanded={howOpen}
              aria-controls={howId}
              onClick={() => setHowOpen((v) => !v)}
            >
              {howOpen ? "−" : "+"} SHOW ME HOW THE LEDGER IS ORDERED
            </button>
          </div>
        </div>

        {howOpen ? (
          <div className="settle-head__protocol" id={howId}>
            <p>
              The ledger and schedule below are the latest daily{" "}
              <GlossaryTerm term="decomposition">decomposition</GlossaryTerm>{" "}
              for the selected SKU, in the model order{" "}
              <span className="mono">
                region → commitment → provider → bundle → residual
              </span>
              , so the running balances match the backend&apos;s sequential
              ANOVA.
            </p>
            <p>
              Order matters for the four factors and not for the last one. Each
              factor is credited only with what it explains after the factors
              before it have had their turn — but the{" "}
              <GlossaryTerm term="residual">residual</GlossaryTerm> at the end
              is the same either way. That is what makes it worth reporting.
            </p>
          </div>
        ) : null}
      </header>

      {/* ——— B · Settlement ledger ——— */}
      {basisState === "ready" && shares && decomposition ? (
        <div className="settle-sheet">
          <div className="settle-sheet__head">
            <span className="settle-sheet__label">
              SETTLEMENT SHEET · SEQUENTIAL ANOVA · {sku}
            </span>
            <span className="settle-sheet__asof">
              AS OF {stampDate} <span className="settle-head__live">LIVE</span>
            </span>
          </div>

          <LedgerWaterfall
            decomposition={decomposition}
            glanceLabel={sku}
            voidLabel="Unfileable"
            className="settle-ledger"
          />

          <p className="settle-sheet__caption">
            Shares of total log-price variance{" "}
            <span className="mono">
              ({decomposition.total_variance.toFixed(4)})
            </span>
            . Observable factors account for{" "}
            <span className="mono">
              {decomposition.pct_explained.toFixed(1)}%
            </span>
            ; the remaining{" "}
            <span className="mono settle-sheet__residual">
              {decomposition.pct_residual.toFixed(1)}%
            </span>{" "}
            is residual basis risk — stamped unfileable above.
          </p>

          <div className="settle-sheet__foot">
            <span>
              EVERY SHARE IS LIVE FROM GET /api/basis · ORDER CREDITS FACTORS,
              NOT THE RESIDUAL
            </span>
            <button
              type="button"
              className="settle-sheet__obs"
              onClick={() => setDrawerOpen(true)}
            >
              View contributing observations →
            </button>
          </div>
        </div>
      ) : (
        <StateSheet
          title={
            basisState === "loading"
              ? "Loading decomposition…"
              : basisState === "error"
                ? "Failed to load decomposition."
                : "No decomposition available."
          }
          body={
            basisState === "loading"
              ? "Fetching the latest daily attribution for this SKU."
              : basisMessage.message
          }
          tone={basisState === "error" ? "error" : "muted"}
        />
      )}

      {/* ——— C · Schedule of accounts ——— */}
      <section className="settle-schedule">
        <div className="settle-schedule__eyebrow">
          04 · Schedule of accounts
        </div>

        {basisState === "ready" && factorRows.length > 0 ? (
          <div className="account-sheet">
            <div className="account-sheet__cols" aria-hidden>
              <span>ACCOUNT</span>
              <span className="account-sheet__right">SHARE</span>
              <span className="account-sheet__right">RUNNING BALANCE</span>
              <span>NOTE</span>
              <span />
            </div>
            {factorRows.map((row) => (
              <AccountRow
                key={row.key}
                row={row}
                open={openAccount === row.key}
                onToggle={() =>
                  setOpenAccount((cur) => (cur === row.key ? null : row.key))
                }
                onInspect={() => setDrawerOpen(true)}
              />
            ))}
          </div>
        ) : (
          <StateSheet
            title={
              basisState === "loading"
                ? "Loading factor table…"
                : basisState === "error"
                  ? "Factor table unavailable."
                  : "No factor contributions yet."
            }
            body={
              basisState === "loading"
                ? "The schedule appears once the daily decomposition has loaded."
                : basisMessage.message
            }
            tone={basisState === "error" ? "error" : "muted"}
          />
        )}
      </section>

      {/* ——— D · Filed quotes ——— */}
      <section className="settle-quotes">
        <div className="settle-quotes__eyebrow">05 · Filed quotes by factor</div>
        <p className="settle-quotes__lede">
          Per-offer prices laid out by a single factor. Tight rows mean the
          factor explains the spread; broad rows mean it doesn&apos;t. The{" "}
          <span className="mono">Residual (within cell)</span> view conditions
          on <span className="mono">(provider × commitment)</span> — within-row
          spread is the basis risk observable factors cannot capture. Every
          dot is a real offer; select one to file its receipt.
        </p>

        <div className="settle-quotes__sheet">
          <div className="settle-quotes__chips">
            <span className="settle-quotes__chips-label">FACTOR</span>
            {SWARM_TABS.map((tab) => (
              <button
                key={tab.factor}
                type="button"
                className={`punch${swarmFactor === tab.factor ? " is-on" : ""}`}
                onClick={() => setSwarmFactor(tab.factor)}
                aria-pressed={swarmFactor === tab.factor}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {observationsQuery.isLoading ? (
            <StateSheet
              title="Loading observations…"
              body="Fetching the canonical offers that fed the current decomposition."
              tone="muted"
              bare
            />
          ) : observationsQuery.isError ? (
            <StateSheet
              title="Failed to load observations."
              body={
                (observationsQuery.error as Error | undefined)?.message ??
                "unknown error"
              }
              tone="error"
              bare
            />
          ) : swarmPoints.length > 0 ? (
            <BeeswarmReceipt
              factor={swarmFactor}
              points={swarmPoints}
              gpuSku={sku}
              onInspect={(id) => setInspectingId(id)}
            />
          ) : (
            <StateSheet
              title="No observations to plot."
              body="The contributing-offer endpoint returned no canonical offers for this decomposition."
              tone="muted"
              bare
            />
          )}
        </div>
      </section>

      <footer className="settle-foot">
        <span className="settle-foot__stamp">
          SHEET 03 OF 06 · SETTLED <em className="serif">Basis</em>
          {stampDate !== "—" ? ` · ${stampDate}` : null}
        </span>
        <Link href="/explainability" className="settle-foot__next">
          Next: the honesty bound →
        </Link>
      </footer>

      <BasisObservationsDrawer
        gpuSku={sku}
        date={decomposition?.date ?? null}
        open={drawerOpen}
        suspendEscape={inspectingId != null}
        onClose={() => setDrawerOpen(false)}
        onInspect={(id) => setInspectingId(id)}
      />
      <BasisRawObservationInspector
        rawObservationId={inspectingId}
        open={inspectingId != null}
        onClose={() => setInspectingId(null)}
      />
    </div>
  );
}

function AccountRow({
  row,
  open,
  onToggle,
  onInspect,
}: {
  row: FactorRow;
  open: boolean;
  onToggle: () => void;
  onInspect: () => void;
}) {
  const isResidual = row.key === "residual";
  const color = isResidual ? "var(--residual)" : factorColor(row.key);

  return (
    <div
      className={`account-row${open ? " is-open" : ""}${isResidual ? " is-residual" : ""}`}
    >
      <button
        type="button"
        className="account-row__main"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="account-row__subject">
          <span
            className="account-row__swatch"
            style={{ background: color }}
            aria-hidden
          />
          <span className="account-row__key">{row.label}</span>
          {isResidual ? (
            <span className="account-row__tag">UNFILEABLE</span>
          ) : null}
        </span>
        <span className="account-row__share">
          {(row.share * 100).toFixed(1)}%
        </span>
        <span className="account-row__balance">
          {(row.balance * 100).toFixed(1)}% left
        </span>
        <span className="account-row__note">{row.note}</span>
        <span className="account-row__caret" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div className="account-row__dossier">
          <div>
            <div className="account-row__dossier-label">
              {isResidual ? "TERMINUS · VOID" : "ACCOUNT · OBSERVED ROLE"}
            </div>
            <p className="account-row__dossier-body">{row.note}</p>
          </div>
          <div className="account-row__dossier-side">
            <div className="account-row__dossier-label account-row__dossier-label--dim">
              PROVENANCE
            </div>
            <p className="account-row__dossier-body">
              SOURCE: GET /api/basis
              <br />
              FIELD: {isResidual ? "residual_variance" : `variance_from_${row.key}`}
              <br />
              BASIS: LATEST DECOMPOSITION DATE
            </p>
            <button
              type="button"
              className="account-row__inspect"
              onClick={onInspect}
            >
              Inspect contributing observations →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StateSheet({
  title,
  body,
  tone,
  bare = false,
}: {
  title: string;
  body: string;
  tone: "muted" | "error";
  bare?: boolean;
}) {
  return (
    <div className={`settle-empty${bare ? " settle-empty--bare" : ""}`}>
      <div
        className="settle-empty__title"
        style={{
          color: tone === "error" ? "var(--verdict-bad)" : undefined,
        }}
      >
        {title}
      </div>
      <p className="settle-empty__body">{body}</p>
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

/** Running balance = unexplained share remaining after this row. */
function buildFactorRows(shares: DecompShares): FactorRow[] {
  let remaining = 1;

  const factorRows = FACTOR_META.map((factor) => {
    remaining -= shares[factor.key];
    return {
      key: factor.key,
      label: factor.label,
      share: shares[factor.key],
      balance: Math.max(0, remaining),
      note: factor.note,
    };
  });

  remaining -= shares.residual;
  return [
    ...factorRows,
    {
      key: "residual",
      label: "Residual",
      share: shares.residual,
      balance: Math.max(0, remaining),
      note: "Everything the four observable factors do not explain on that day.",
    },
  ];
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
        "Not enough data yet to decompose this SKU. Basis needs at least five offers on a single day with variation across the modeled factors.",
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
    message: "No basis decomposition is available for this SKU yet.",
  };
}
