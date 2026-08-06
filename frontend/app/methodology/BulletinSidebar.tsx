"use client";

import { SKUS, type SkuId } from "./sim/bulletinSim";

const TOC = [
  { href: "#file-00", label: "00 · THE QUESTION" },
  { href: "#file-01", label: "01 · COLLECTION & CUSTODY" },
  { href: "#file-02", label: "02 · NOMENCLATURE" },
  { href: "#file-03", label: "03 · DISPERSION" },
  { href: "#file-04", label: "04 · THE SUBTRACTION" },
  { href: "#file-05", label: "05 · THE FINDING" },
  { href: "#file-06", label: "06 · LIMITATIONS" },
  { href: "#letters", label: "LETTERS TO THE EDITOR" },
  { href: "#subscribe", label: "SUBSCRIPTIONS" },
] as const;

interface BulletinSidebarProps {
  sku: SkuId;
  marketPct: string;
  onPickSku: (id: SkuId) => void;
}

export function BulletinSidebar({
  sku,
  marketPct,
  onPickSku,
}: BulletinSidebarProps) {
  return (
    <aside className="bull-front__side">
      <div className="bull-side-label">In this edition</div>
      <nav className="bull-toc" aria-label="Sections">
        {TOC.map((item) => (
          <div key={item.href}>
            <a href={item.href}>{item.label}</a>
          </div>
        ))}
      </nav>

      <div className="bull-side-label">Today&apos;s figures</div>
      <div className="bull-figures">
        PROVIDERS ....... <span className="bull-sim">[LIVE]</span>
        <br />
        COLLECTIONS ..... 2×/DAY
        <br />
        MODEL ........... SEQ. ANOVA
        <br />
        RESIDUAL (MKT) .. {marketPct}%{" "}
        <span className="bull-sim">[SIM]</span>
      </div>

      <div className="bull-side-label">This edition covers</div>
      <div className="bull-editions" role="group" aria-label="Choose SKU edition">
        {(Object.keys(SKUS) as SkuId[]).map((id) => {
          const active = id === sku;
          return (
            <button
              key={id}
              type="button"
              className="bull-edition"
              aria-pressed={active}
              onClick={() => onPickSku(id)}
            >
              {active ? "☑" : "☐"} {SKUS[id].label}
            </button>
          );
        })}
      </div>
      <div className="bull-edition-hint">
        Every figure on this page re-sets to the chosen edition. In production
        this is the ?sku= control.
      </div>
    </aside>
  );
}
