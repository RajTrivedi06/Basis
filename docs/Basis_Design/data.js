// Basis — realistic mock data grounded in the finding.
// Residual variance dominates. Every number is keyed to the thesis.

window.BASIS_DATA = (() => {
  // Canonical SKUs, sorted by offer volume (what we'd expect in reality)
  const SKUS = [
    { id: 'h100_sxm_80gb',   label: 'H100 SXM 80GB',   family: 'Hopper',  offers: 4821, providers: 4, medianPrice: 2.94, priceMin: 0.45, priceMax: 6.88, residual: 0.704, variance: 0.323 },
    { id: 'a100_sxm_80gb',   label: 'A100 SXM 80GB',   family: 'Ampere',  offers: 3104, providers: 4, medianPrice: 1.48, priceMin: 0.39, priceMax: 3.20, residual: 0.412, variance: 0.186 },
    { id: 'rtx_4090',        label: 'RTX 4090',        family: 'Consumer',offers: 2967, providers: 3, medianPrice: 0.48, priceMin: 0.18, priceMax: 1.62, residual: 0.871, variance: 0.441 },
    { id: 'a100_sxm_40gb',   label: 'A100 SXM 40GB',   family: 'Ampere',  offers: 1892, providers: 4, medianPrice: 1.12, priceMin: 0.36, priceMax: 2.48, residual: 0.389, variance: 0.162 },
    { id: 'h200_sxm_141gb',  label: 'H200 SXM 141GB',  family: 'Hopper',  offers: 1205, providers: 3, medianPrice: 4.10, priceMin: 2.80, priceMax: 8.92, residual: 0.618, variance: 0.274 },
    { id: 'l40s',            label: 'L40S',            family: 'Ada',     offers: 1118, providers: 4, medianPrice: 1.06, priceMin: 0.52, priceMax: 2.28, residual: 0.533, variance: 0.201 },
    { id: 'rtx_6000_ada',    label: 'RTX 6000 Ada',    family: 'Ada',     offers:  847, providers: 3, medianPrice: 0.91, priceMin: 0.41, priceMax: 2.04, residual: 0.762, variance: 0.302 },
    { id: 'a40',             label: 'A40',             family: 'Ampere',  offers:  612, providers: 3, medianPrice: 0.62, priceMin: 0.28, priceMax: 1.48, residual: 0.547, variance: 0.188 },
    { id: 'rtx_a6000',       label: 'RTX A6000',       family: 'Ampere',  offers:  521, providers: 3, medianPrice: 0.74, priceMin: 0.30, priceMax: 1.82, residual: 0.681, variance: 0.231 },
    { id: 'v100_sxm2_32gb',  label: 'V100 SXM2 32GB',  family: 'Volta',   offers:  418, providers: 3, medianPrice: 0.71, priceMin: 0.32, priceMax: 1.56, residual: 0.421, variance: 0.138 },
    { id: 'rtx_3090',        label: 'RTX 3090',        family: 'Consumer',offers:  388, providers: 2, medianPrice: 0.26, priceMin: 0.12, priceMax: 0.78, residual: 0.812, variance: 0.298 },
    { id: 'mi300x',          label: 'MI300X',          family: 'AMD',     offers:  142, providers: 2, medianPrice: 3.85, priceMin: 2.50, priceMax: 6.20, residual: null, variance: null, insufficient: true, daysCollected: 12 },
  ];

  // Residual as % of total log-price variance, three snapshot days from the brief
  const RESIDUAL_SNAPSHOTS = [
    { date: '2026-04-17', totalVar: 0.323, residualVar: 0.227, pct: 0.704 },
    { date: '2026-04-18', totalVar: 0.227, residualVar: 0.215, pct: 0.947 },
    { date: '2026-04-20', totalVar: 0.301, residualVar: 0.161, pct: 0.535 },
  ];

  // Decomposition for H100 SXM 80GB — residual is the protagonist
  const DECOMP_H100 = {
    sku: 'h100_sxm_80gb',
    asOf: '2026-04-20',
    totalVarLogPrice: 0.301,
    // Share of explained variance (must sum to 1 - residualShare)
    factors: [
      { key: 'provider',   label: 'Provider identity',  share: 0.187, note: '4 providers; pricing power asymmetry' },
      { key: 'commitment', label: 'Commitment type',    share: 0.142, note: 'on_demand vs spot vs reserved_1y' },
      { key: 'region',     label: 'Region',             share: 0.089, note: 'us-east-1 anchor; sparse outside' },
      { key: 'bundle',     label: 'Bundled resources',  share: 0.047, note: 'vCPU, RAM, NVMe, interconnect' },
    ],
    residualShare: 0.535,
  };

  // Per-SKU decomposition — A100 tighter, 4090 looser
  const DECOMPS = {
    h100_sxm_80gb:  { total: 0.301, provider: 0.187, commitment: 0.142, region: 0.089, bundle: 0.047, residual: 0.535 },
    a100_sxm_80gb:  { total: 0.186, provider: 0.241, commitment: 0.198, region: 0.102, bundle: 0.047, residual: 0.412 },
    rtx_4090:       { total: 0.441, provider: 0.062, commitment: 0.041, region: 0.018, bundle: 0.008, residual: 0.871 },
    a100_sxm_40gb:  { total: 0.162, provider: 0.258, commitment: 0.211, region: 0.098, bundle: 0.044, residual: 0.389 },
    h200_sxm_141gb: { total: 0.274, provider: 0.158, commitment: 0.132, region: 0.070, bundle: 0.022, residual: 0.618 },
    l40s:           { total: 0.201, provider: 0.181, commitment: 0.152, region: 0.098, bundle: 0.036, residual: 0.533 },
    rtx_6000_ada:   { total: 0.302, provider: 0.091, commitment: 0.080, region: 0.048, bundle: 0.019, residual: 0.762 },
    a40:            { total: 0.188, provider: 0.171, commitment: 0.148, region: 0.091, bundle: 0.043, residual: 0.547 },
    rtx_a6000:      { total: 0.231, provider: 0.112, commitment: 0.110, region: 0.064, bundle: 0.033, residual: 0.681 },
    v100_sxm2_32gb: { total: 0.138, provider: 0.245, commitment: 0.198, region: 0.092, bundle: 0.044, residual: 0.421 },
    rtx_3090:       { total: 0.298, provider: 0.082, commitment: 0.061, region: 0.030, bundle: 0.015, residual: 0.812 },
  };

  const PROVIDERS = [
    { id: 'vast',        label: 'Vast.ai',     type: 'marketplace', coverage: 97, freshness: '4 min',  medDev: +0.14, offers: 5821, unknownPct: 0.08 },
    { id: 'runpod',      label: 'RunPod',      type: 'marketplace', coverage: 48, freshness: '6 min',  medDev: -0.02, offers: 2914, unknownPct: 0.03 },
    { id: 'aws_spot',    label: 'AWS EC2 Spot',type: 'hyperscaler', coverage: 14, freshness: '15 min', medDev: +0.22, offers: 1208, unknownPct: 0.00 },
    { id: 'tensordock',  label: 'TensorDock',  type: 'marketplace', coverage: 36, freshness: '9 min',  medDev: -0.08, offers: 1847, unknownPct: 0.12 },
  ];

  const COMMITMENTS = [
    { id: 'on_demand',   label: 'On-demand',    count: 7892 },
    { id: 'spot',        label: 'Spot',         count: 1842 },
    { id: 'reserved_1m', label: 'Reserved 1m',  count:  812 },
    { id: 'reserved_3m', label: 'Reserved 3m',  count:  421 },
    { id: 'reserved_1y', label: 'Reserved 1y',  count:  238 },
  ];

  const REGIONS = [
    { id: 'us-east-1', label: 'us-east-1', count: 3241 },
    { id: 'us-west-2', label: 'us-west-2', count: 1842 },
    { id: 'eu-west-1', label: 'eu-west-1', count: 1204 },
    { id: 'eu-north-1',label: 'eu-north-1',count:  721 },
    { id: 'ap-south-1',label: 'ap-south-1',count:  412 },
    { id: 'UNKNOWN',   label: 'UNKNOWN',   count:  892, unknown: true },
  ];

  const VERIFICATION = [
    { id: 'verified',   label: 'Verified host',     count: 6124 },
    { id: 'unverified', label: 'Unverified host',   count: 3412 },
    { id: 'UNKNOWN',    label: 'UNKNOWN',           count:  287, unknown: true },
  ];

  // Rolling residual time series for H100 SXM — 60 days ending 2026-04-20
  // Synthesized to honor the three anchor points (70.4%, 94.7%, 53.5%)
  const ROLLING_H100 = (() => {
    const days = 60;
    const end = new Date('2026-04-20');
    const arr = [];
    // seed with a deterministic pseudo-random walk around 65%
    let r = 0.62;
    const seeds = [0.62,0.63,0.58,0.61,0.66,0.70,0.73,0.69,0.64,0.60,0.58,0.55,0.52,0.56,0.61,0.67,0.74,0.81,0.78,0.71,0.65,0.62,0.59,0.57,0.61,0.66,0.72,0.76,0.79,0.83,0.80,0.74,0.69,0.66,0.63,0.59,0.62,0.68,0.73,0.77,0.72,0.66,0.61,0.58,0.63,0.70,0.78,0.84,0.89,0.93,0.91,0.85,0.78,0.70,0.62,0.56,0.58,0.65,0.71,0.70];
    for (let i = 0; i < days; i++) {
      const d = new Date(end); d.setDate(d.getDate() - (days - 1 - i));
      const iso = d.toISOString().slice(0, 10);
      // pin anchor points
      let pct = seeds[i];
      if (iso === '2026-04-17') pct = 0.704;
      if (iso === '2026-04-18') pct = 0.947;
      if (iso === '2026-04-20') pct = 0.535;
      const band = 0.04 + (i < 14 ? 0.06 : 0.02); // wider band early (less data)
      arr.push({
        date: iso,
        pct,
        lo: Math.max(0, pct - band),
        hi: Math.min(1, pct + band),
        sampleN: 80 + Math.round(Math.random() * 40) + i * 3,
      });
    }
    return arr;
  })();

  // Regime markers overlaid on the rolling chart
  const REGIMES = [
    { date: '2026-03-04', label: 'H100 supply loosens', kind: 'supply' },
    { date: '2026-03-19', label: 'AWS Spot price step', kind: 'policy' },
    { date: '2026-04-08', label: 'Vast.ai listing surge', kind: 'supply' },
    { date: '2026-04-18', label: 'Residual peak 94.7%',  kind: 'anomaly' },
  ];

  // Factor stability — small multiples
  const FACTOR_STABILITY = ['provider','commitment','region','bundle'].map((k) => {
    const base = { provider: 0.18, commitment: 0.14, region: 0.09, bundle: 0.05 }[k];
    const series = [];
    for (let i = 0; i < 60; i++) {
      const n = base + (Math.sin(i * 0.2 + {provider:1,commitment:2,region:3,bundle:4}[k]) * 0.025) + (Math.random() - 0.5) * 0.012;
      series.push(Math.max(0, n));
    }
    return { key: k, label: { provider: 'Provider', commitment: 'Commitment', region: 'Region', bundle: 'Bundle' }[k], series };
  });

  // Dispersion — p25 / median / p75 for H100 SXM over 60 days
  const DISPERSION_H100 = (() => {
    const days = 60;
    const end = new Date('2026-04-20');
    const arr = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(end); d.setDate(d.getDate() - (days - 1 - i));
      const med = 2.85 + Math.sin(i * 0.18) * 0.35 + (Math.random() - 0.5) * 0.1;
      arr.push({
        date: d.toISOString().slice(0, 10),
        p10: med - 1.20 - Math.random() * 0.3,
        p25: med - 0.80 - Math.random() * 0.15,
        p50: med,
        p75: med + 0.95 + Math.random() * 0.25,
        p90: med + 2.20 + Math.random() * 0.4,
      });
    }
    return arr;
  })();

  // Canonical offers for H100 SXM drilldown
  const H100_OFFERS = [
    { id: 'obs_8f12',  provider: 'vast',       region: 'us-east-1', commitment: 'on_demand',   price: 2.84, vcpu: 16, ram: 128, nvme: 960, verified: true,  collectedAt: '2026-04-20T14:12Z' },
    { id: 'obs_8f13',  provider: 'vast',       region: 'UNKNOWN',   commitment: 'on_demand',   price: 1.98, vcpu: 12, ram: 96,  nvme: 480, verified: false, collectedAt: '2026-04-20T14:11Z', unknown: ['region'] },
    { id: 'obs_8f14',  provider: 'runpod',     region: 'us-west-2', commitment: 'spot',        price: 2.21, vcpu: 24, ram: 192, nvme: 1920, verified: true,  collectedAt: '2026-04-20T14:08Z' },
    { id: 'obs_8f15',  provider: 'aws_spot',   region: 'us-east-1', commitment: 'spot',        price: 4.12, vcpu: 32, ram: 256, nvme: 3840, verified: true,  collectedAt: '2026-04-20T14:05Z' },
    { id: 'obs_8f16',  provider: 'tensordock', region: 'eu-west-1', commitment: 'reserved_1m', price: 2.58, vcpu: 16, ram: 128, nvme: 1920, verified: true,  collectedAt: '2026-04-20T13:58Z' },
    { id: 'obs_8f17',  provider: 'vast',       region: 'us-east-1', commitment: 'on_demand',   price: 0.45, vcpu: 8,  ram: 64,  nvme: 480, verified: false, collectedAt: '2026-04-20T13:54Z' },
    { id: 'obs_8f18',  provider: 'aws_spot',   region: 'us-east-1', commitment: 'reserved_1y', price: 3.20, vcpu: 32, ram: 256, nvme: 3840, verified: true,  collectedAt: '2026-04-20T13:52Z' },
    { id: 'obs_8f19',  provider: 'vast',       region: 'ap-south-1',commitment: 'on_demand',   price: 6.88, vcpu: 32, ram: 512, nvme: 7680, verified: true,  collectedAt: '2026-04-20T13:50Z' },
    { id: 'obs_8f1a',  provider: 'runpod',     region: 'us-east-1', commitment: 'on_demand',   price: 2.99, vcpu: 16, ram: 128, nvme: 960, verified: true,  collectedAt: '2026-04-20T13:47Z' },
    { id: 'obs_8f1b',  provider: 'tensordock', region: 'UNKNOWN',   commitment: 'on_demand',   price: 2.12, vcpu: null, ram: 96,  nvme: null, verified: false, collectedAt: '2026-04-20T13:45Z', unknown: ['region','vcpu','nvme'] },
  ];

  // Raw observation from Vast.ai for obs_8f12 — shown side-by-side with canonical
  const RAW_OBS_8F12 = {
    source: 'vast.ai /api/v0/bundles',
    fetchedAt: '2026-04-20T14:12:03Z',
    payload: {
      id: 14827193,
      gpu_name: 'RTX H100 SXM5',
      num_gpus: 1,
      dph_total: 2.842,
      disk_space: 960.0,
      cpu_cores: 16,
      cpu_ram: 131072,
      datacenter: 'US-E-1',
      verification: 'verified',
      machine_id: 29481,
      rentable: true,
      min_bid: 1.898
    },
    decisions: [
      { field: 'gpu_sku',    from: 'RTX H100 SXM5',  to: 'h100_sxm_80gb', rule: 'regex /H100\\s?SXM/ → canonical h100_sxm_80gb' },
      { field: 'price_hour', from: '2.842',          to: '$2.84/hr',      rule: 'dph_total taken as-is (1 GPU)' },
      { field: 'region',     from: 'US-E-1',         to: 'us-east-1',     rule: 'alias table; confidence HIGH' },
      { field: 'commitment', from: '(implicit)',     to: 'on_demand',     rule: 'dph_total present without bid → on_demand' },
      { field: 'ram_gb',     from: '131072 (MB)',    to: '128',           rule: 'MB→GB ÷1024' },
      { field: 'verified',   from: 'verified',       to: 'true',          rule: 'exact match on enum' },
    ]
  };

  const FINDINGS_SHORT = {
    headlineLo: 53,
    headlineHi: 95,
    windowDays: 4,
    totalObs: 14213,
    skusCovered: 97,
    providers: 4,
  };

  return {
    SKUS, RESIDUAL_SNAPSHOTS, DECOMP_H100, DECOMPS, PROVIDERS, COMMITMENTS, REGIONS,
    VERIFICATION, ROLLING_H100, REGIMES, FACTOR_STABILITY, DISPERSION_H100,
    H100_OFFERS, RAW_OBS_8F12, FINDINGS_SHORT,
  };
})();
