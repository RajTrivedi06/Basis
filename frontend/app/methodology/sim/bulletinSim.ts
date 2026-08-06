/** Deterministic simulated panel for the methodology bulletin (frontend-only). */

export type FactorKey = "region" | "commitment" | "provider" | "bundle";

export type SkuId = "h100_sxm_80gb" | "a100_sxm_80gb" | "rtx_4090_24gb";

export interface SkuDef {
  label: string;
  base: number;
  sigma: number;
  eff: number;
  seed: number;
}

export const SKUS: Record<SkuId, SkuDef> = {
  h100_sxm_80gb: { label: "H100 SXM 80GB", base: 2.85, sigma: 1.06, eff: 1, seed: 11 },
  a100_sxm_80gb: { label: "A100 SXM 80GB", base: 1.42, sigma: 0.47, eff: 1, seed: 22 },
  rtx_4090_24gb: { label: "RTX 4090 24GB", base: 0.46, sigma: 1.63, eff: 0.5, seed: 33 },
};

export const DEFAULT_SKU: SkuId = "h100_sxm_80gb";

export const DEFAULT_ORDER: FactorKey[] = [
  "region",
  "commitment",
  "provider",
  "bundle",
];

export const FACTOR_META: Record<
  FactorKey,
  { label: string; patternId: string }
> = {
  region: { label: "WHERE IT IS: REGION", patternId: "bull-hA" },
  commitment: { label: "HOW IT'S RENTED: COMMITMENT", patternId: "bull-hC" },
  provider: { label: "WHO SELLS IT: PROVIDER", patternId: "bull-hB" },
  bundle: { label: "WHAT'S BUNDLED: BUNDLE", patternId: "bull-hD" },
};

export interface Offer {
  provider: string;
  region: string;
  commitment: string;
  bundle: string;
  price: number;
}

export interface AnovaResult {
  shares: Record<FactorKey, number>;
  residual: number;
  n: number;
}

export interface Dot {
  cx: number;
  cy: number;
}

function rng(seed: number): () => number {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function genOffers(skuId: SkuId): Offer[] {
  const P = SKUS[skuId];
  const rnd = rng(P.seed);
  const es = P.eff;
  const regions = ["US", "DE", "JP"];
  const rEff: Record<string, number> = {
    US: 0,
    DE: 0.06,
    JP: 0.12,
    UNKNOWN: 0.03,
  };
  const cEff: Record<string, number> = { on_demand: 0, spot: -0.55 };
  const bEff: Record<string, number> = {
    Q1: -0.12,
    Q2: 0,
    Q3: 0.14,
    UNKNOWN: 0,
  };
  const pEff: Record<string, number> = {
    vast: 0,
    runpod: 0.05,
    aws: 0.5,
  };
  const catEff: Record<string, number> = { azure: 2.2, gcp: 2.1 };
  const offers: Offer[] = [];

  const push = (
    provider: string,
    count: number,
    opts: { bundle?: boolean; noRegion?: boolean; cat?: boolean },
  ) => {
    for (let i = 0; i < count; i++) {
      const region = opts.noRegion
        ? "UNKNOWN"
        : regions[Math.floor(rnd() * 3)];
      const commitment = rnd() < 0.5 ? "on_demand" : "spot";
      const bundle = opts.bundle
        ? (["Q1", "Q2", "Q3"] as const)[Math.floor(rnd() * 3)]
        : "UNKNOWN";
      let y: number;
      if (opts.cat) {
        y =
          Math.log(P.base) +
          catEff[provider] +
          rEff[region] * 3 +
          cEff[commitment];
      } else {
        const noise = (rnd() * 2 - 1) * P.sigma;
        y =
          Math.log(P.base) +
          es *
            (rEff[region] +
              cEff[commitment] +
              pEff[provider] +
              (opts.bundle ? bEff[bundle] : 0)) +
          noise;
      }
      offers.push({
        provider,
        region,
        commitment,
        bundle,
        price: Math.exp(y),
      });
    }
  };

  push("vast", 100, { bundle: true });
  push("runpod", 12, { noRegion: true });
  push("aws", 14, {});
  push("azure", 30, { cat: true });
  push("gcp", 30, { cat: true });
  return offers;
}

export function anova(offers: Offer[], order: FactorKey[]): AnovaResult {
  const ys = offers.map((o) => Math.log(o.price));
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const total = ys.reduce((a, y) => a + (y - mean) ** 2, 0);
  let keys = offers.map(() => "");
  let prevWithin = total;
  const shares = {} as Record<FactorKey, number>;

  order.forEach((f) => {
    const vals = offers.map((o) => o[f] || "UNKNOWN");
    if (new Set(vals).size < 2) {
      shares[f] = 0;
      return;
    }
    keys = keys.map((k, i) => k + "|" + vals[i]);
    const groups: Record<string, number[]> = {};
    keys.forEach((k, i) => {
      (groups[k] = groups[k] || []).push(ys[i]);
    });
    let within = 0;
    Object.values(groups).forEach((g) => {
      const m = g.reduce((a, b) => a + b, 0) / g.length;
      g.forEach((y) => {
        within += (y - m) ** 2;
      });
    });
    shares[f] = Math.max(0, prevWithin - within) / total;
    prevWithin = within;
  });

  const residual =
    Math.max(
      0,
      total - Object.values(shares).reduce((a, b) => a + b, 0) * total,
    ) / total;

  return { shares, residual, n: offers.length };
}

export function quant(sorted: number[], p: number): number {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export function genSeries(
  skuId: SkuId,
  market: boolean,
  endVal: number,
): number[] {
  const rnd = rng(SKUS[skuId].seed + (market ? 7 : 5));
  let v = endVal;
  const arr: number[] = [];
  const min = Math.max(2, endVal * 0.65);
  const max = Math.min(88, endVal * 1.35 + 5);
  const step = market ? 2.6 : 0.9;
  for (let i = 0; i < 60; i++) {
    arr.push(v);
    v = Math.min(max, Math.max(min, v + (rnd() * 2 - 1) * step));
  }
  arr.reverse();
  arr[59] = endVal;
  return arr;
}

export function pathFrom(arr: number[]): string {
  return arr
    .map(
      (v, i) =>
        (i ? "L" : "M") +
        (40 + i * (650 / 59)).toFixed(1) +
        "," +
        (200 - (v / 90) * 180).toFixed(1),
    )
    .join(" ");
}

export function money(v: number): string {
  return "$" + v.toFixed(2);
}

export function ordinal(i: number): string {
  return i + 1 + (["ST", "ND", "RD", "TH"][i] || "TH");
}

export interface BulletinView {
  skuLabel: string;
  skuCode: SkuId;
  n: number;
  mktN: number;
  minP: string;
  maxP: string;
  medP: string;
  p25P: string;
  p75P: string;
  spread: string;
  dots: Dot[];
  axMinX: number;
  axMedX: number;
  axMaxX: number;
  bandX: number;
  bandW: number;
  bandRX: number;
  segs: { x: number; w: number; fill: string; key: FactorKey }[];
  residX: number;
  residW: number;
  residMidX: number;
  residPct: string;
  rows: {
    key: FactorKey;
    pos: string;
    label: string;
    fill: string;
    pct: string;
    upDis: boolean;
    downDis: boolean;
  }[];
  orderText: string;
  stages: { num: string; name: string; count: string; note: string }[];
  marketPct: string;
  pooledPct: string;
  seriesPath: string;
  ghostPath: string;
  lastX: number;
  lastY: number;
  lastLabelX: number;
  lastLabelY: number;
  activePct: string;
  seriesRows: { day: string; val: string }[];
  popTitle: string;
}

export function buildBulletinView(
  sku: SkuId,
  order: FactorKey[],
  catalogs: boolean,
): BulletinView {
  const P = SKUS[sku];
  const all = genOffers(sku);
  const market = all.filter(
    (o) => o.provider !== "azure" && o.provider !== "gcp",
  );
  const prices = all.map((o) => o.price).sort((a, b) => a - b);
  const med = quant(prices, 0.5);
  const p25 = quant(prices, 0.25);
  const p75 = quant(prices, 0.75);
  const lo = Math.log(prices[0]) - 0.06;
  const hi = Math.log(prices[prices.length - 1]) + 0.06;
  const X = (p: number) =>
    +(40 + ((Math.log(p) - lo) / (hi - lo)) * 640).toFixed(1);
  const jr = rng(99);
  const dots = all.map((o) => ({
    cx: X(o.price),
    cy: +(30 + jr() * 100).toFixed(1),
  }));

  const led = anova(market, order);
  const pooledRes = anova(all, DEFAULT_ORDER).residual;
  const marketRes = anova(market, DEFAULT_ORDER).residual;

  let cx = 40;
  const segs = order.map((f) => {
    const w = +(led.shares[f] * 640).toFixed(1);
    const s = {
      x: +cx.toFixed(1),
      w,
      fill: `url(#${FACTOR_META[f].patternId})`,
      key: f,
    };
    cx += w;
    return s;
  });
  const residW = +(led.residual * 640).toFixed(1);

  const rows = order.map((f, i) => ({
    key: f,
    pos: ordinal(i),
    label: FACTOR_META[f].label,
    fill: `url(#${FACTOR_META[f].patternId})`,
    pct: (led.shares[f] * 100).toFixed(1),
    upDis: i === 0,
    downDis: i === 3,
  }));

  const marketPct = (marketRes * 100).toFixed(1);
  const pooledPct = (pooledRes * 100).toFixed(1);
  const activeArr = genSeries(
    sku,
    !catalogs,
    +(catalogs ? pooledPct : marketPct),
  );
  const ghostArr = genSeries(
    sku,
    catalogs,
    +(catalogs ? marketPct : pooledPct),
  );
  const lastV = activeArr[59];
  const lastX = +(40 + 59 * (650 / 59)).toFixed(1);
  const lastY = +(200 - (lastV / 90) * 180).toFixed(1);

  const skipped = 3;
  const stages = [
    {
      num: "1",
      name: "COLLECT",
      count: `${all.length + skipped} QUOTES [SIM]`,
      note: "5 PROVIDERS · 08:00 & 20:00 UTC",
    },
    {
      num: "2",
      name: "SEAL RAW",
      count: `${all.length + skipped} ORIGINALS [SIM]`,
      note: "WRITE-ONCE · FULL RESPONSE KEPT",
    },
    {
      num: "3",
      name: "TRANSLATE",
      count: `${all.length} FILED [SIM]`,
      note: `${skipped} SET ASIDE: NOT IN THE BOOK`,
    },
    {
      num: "4",
      name: "ADMIT TO PANEL",
      count: `${all.length} ADMITTED [SIM]`,
      note: "CRON-COLLECTED ONLY · BACKFILL HELD OUT",
    },
    {
      num: "5",
      name: "MEASURE",
      count: "3 FIGURES + LEDGER",
      note: "MEDIAN · MIDDLE HALF · DECOMPOSITION",
    },
  ];

  return {
    skuLabel: P.label,
    skuCode: sku,
    n: all.length,
    mktN: market.length,
    minP: money(prices[0]),
    maxP: money(prices[prices.length - 1]),
    medP: money(med),
    p25P: money(p25),
    p75P: money(p75),
    spread: (prices[prices.length - 1] / prices[0]).toFixed(1) + "×",
    dots,
    axMinX: X(prices[0]),
    axMedX: X(med),
    axMaxX: X(prices[prices.length - 1]),
    bandX: X(p25),
    bandW: +(X(p75) - X(p25)).toFixed(1),
    bandRX: X(p75),
    segs,
    residX: +cx.toFixed(1),
    residW,
    residMidX: +(cx + residW / 2).toFixed(1),
    residPct: (led.residual * 100).toFixed(1),
    rows,
    orderText: order.map((f) => f.toUpperCase()).join(" → "),
    stages,
    marketPct,
    pooledPct,
    seriesPath: pathFrom(activeArr),
    ghostPath: pathFrom(ghostArr),
    lastX,
    lastY,
    lastLabelX: lastX - 14,
    lastLabelY: Math.max(16, lastY - 12),
    activePct: lastV.toFixed(1),
    seriesRows: activeArr
      .filter((_, i) => i % 6 === 5)
      .map((v, i) => ({ day: "DAY " + (i * 6 + 6), val: v.toFixed(1) })),
    popTitle: catalogs
      ? "POOLED PANEL: ALL PROVIDERS"
      : "MARKET-PRICED PANEL: AZURE, GCP EXCLUDED",
  };
}

export function moveFactor(
  order: FactorKey[],
  index: number,
  delta: number,
): FactorKey[] {
  const next = [...order];
  const j = index + delta;
  if (j < 0 || j > 3) return order;
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}
