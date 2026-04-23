/* global React */
// Basis — Slice Builder, Rolling Stability, Dispersion, Providers, Methodology

function SlicePage() {
  const D = window.BASIS_DATA;
  const { skuId } = useBasis();
  const [f, setF] = useState({
    commitments: ['on_demand'],
    regions: ['us-east-1','us-west-2'],
    providers: ['vast','runpod','aws_spot','tensordock'],
    verification: ['verified','unverified'],
  });
  const toggle = (k, v) => setF(s => ({ ...s, [k]: s[k].includes(v) ? s[k].filter(x=>x!==v) : [...s[k], v] }));

  // Derived verdict — more filters → smaller sample, larger residual typically
  const verdict = useMemo(() => {
    const base = D.DECOMPS[skuId] || D.DECOMPS.h100_sxm_80gb;
    const sampleBase = (D.SKUS.find(s=>s.id===skuId) || D.SKUS[0]).offers;
    const commitRatio = f.commitments.length / D.COMMITMENTS.length;
    const regionRatio = f.regions.length / D.REGIONS.filter(r=>!r.unknown).length;
    const provRatio   = f.providers.length / D.PROVIDERS.length;
    const verRatio    = f.verification.length / D.VERIFICATION.filter(v=>!v.unknown).length;
    const retention = commitRatio * regionRatio * provRatio * verRatio;
    const sample = Math.max(8, Math.round(sampleBase * retention * 0.32));
    // Within a tighter slice, some of 'provider' and 'commitment' variance collapses into residual
    const collapse = (1 - provRatio) * base.provider + (1 - commitRatio) * base.commitment * 0.7 + (1 - regionRatio) * base.region * 0.5;
    const residual = Math.min(0.98, base.residual + collapse);
    let label = 'insufficient', tone = 'bad';
    if (sample >= 120 && residual < 0.55) { label = 'benchmarkable'; tone = 'ok'; }
    else if (sample >= 40 && residual < 0.75) { label = 'marginal'; tone = 'warn'; }
    return { residual, sample, label, tone, retention };
  }, [f, skuId, D]);

  return (
    <div className="page-wide fade-up" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 32, alignItems: 'start' }}>
      {/* Filter rail */}
      <aside style={{ position: 'sticky', top: 88, alignSelf: 'start' }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>04 · Slice builder</div>
        <h2 className="serif" style={{ fontSize: 22, margin: '0 0 18px', fontWeight: 400, letterSpacing: '-0.01em' }}>Narrow the slice</h2>

        <FilterGroup label="Commitment">
          {D.COMMITMENTS.map(c => <Chip key={c.id} on={f.commitments.includes(c.id)} onClick={() => toggle('commitments', c.id)} label={c.label} count={c.count} />)}
        </FilterGroup>
        <FilterGroup label="Region">
          {D.REGIONS.map(r => <Chip key={r.id} on={f.regions.includes(r.id)} onClick={() => toggle('regions', r.id)} label={r.label} count={r.count} unknown={r.unknown} />)}
        </FilterGroup>
        <FilterGroup label="Provider">
          {D.PROVIDERS.map(p => <Chip key={p.id} on={f.providers.includes(p.id)} onClick={() => toggle('providers', p.id)} label={p.label} count={p.offers} />)}
        </FilterGroup>
        <FilterGroup label="Verification">
          {D.VERIFICATION.map(v => <Chip key={v.id} on={f.verification.includes(v.id)} onClick={() => toggle('verification', v.id)} label={v.label} count={v.count} unknown={v.unknown} />)}
        </FilterGroup>
      </aside>

      {/* Verdict + decomposition */}
      <div>
        <section style={{ paddingTop: 4 }}>
          <VerdictCard verdict={verdict} />
        </section>

        <section style={{ paddingTop: 28 }}>
          <div className="sec-eyebrow"><span className="num">02</span><h2>Decomposition in this slice</h2></div>
          <DecompBar decomp={{
            provider:   (D.DECOMPS[skuId] || D.DECOMPS.h100_sxm_80gb).provider * (f.providers.length / D.PROVIDERS.length),
            commitment: (D.DECOMPS[skuId] || D.DECOMPS.h100_sxm_80gb).commitment * (f.commitments.length / D.COMMITMENTS.length),
            region:     (D.DECOMPS[skuId] || D.DECOMPS.h100_sxm_80gb).region * (f.regions.length / D.REGIONS.filter(r=>!r.unknown).length),
            bundle:     (D.DECOMPS[skuId] || D.DECOMPS.h100_sxm_80gb).bundle,
            residual:   verdict.residual,
          }} height={96} />
        </section>

        <section style={{ paddingTop: 28 }}>
          <div className="sec-eyebrow"><span className="num">03</span><h2>Why this verdict?</h2></div>
          <div className="panel" style={{ padding: 20 }}>
            <Threshold label="Sample size" val={verdict.sample} ok={verdict.sample >= 120} marginal={verdict.sample >= 40} thresholds="benchmarkable ≥ 120 · marginal ≥ 40" />
            <Threshold label="Residual share" val={`${(verdict.residual*100).toFixed(1)}%`} ok={verdict.residual < 0.55} marginal={verdict.residual < 0.75} thresholds="benchmarkable < 55% · marginal < 75%" invert />
            <Threshold label="Slice retention" val={`${(verdict.retention*100).toFixed(0)}% of full population`} ok={verdict.retention >= 0.25} marginal={verdict.retention >= 0.08} thresholds="benchmarkable ≥ 25% · marginal ≥ 8%" />
          </div>
        </section>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }) {
  return <div style={{ marginBottom: 20 }}>
    <div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>
  </div>;
}
function Chip({ on, onClick, label, count, unknown }) {
  return <button onClick={onClick} className={`chip ${on ? 'on' : ''}`}>
    {unknown ? <span className="pill-unknown" style={{ padding: 0, background: 'transparent' }}>?</span> : <span className="dot" style={{ opacity: on ? 1 : 0.25 }} />}
    <span>{label}</span>
    <span className="mono" style={{ fontSize: 10, color: 'var(--ink-dim)', marginLeft: 4 }}>{count}</span>
  </button>;
}

function VerdictCard({ verdict }) {
  const colorByTone = { ok: 'var(--verdict-ok)', warn: 'var(--verdict-warn)', bad: 'var(--verdict-bad)' };
  const glyph = { ok: '✓', warn: '△', bad: '✕' };
  return (
    <div className="panel" style={{ padding: 26, display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 32, alignItems: 'center' }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Verdict</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span className="mono" style={{ color: colorByTone[verdict.tone], fontSize: 24 }}>{glyph[verdict.tone]}</span>
          <span className="display" style={{ fontSize: 40, color: 'var(--ink-hi)', letterSpacing: '-0.02em', textTransform: 'lowercase' }}>{verdict.label}</span>
        </div>
        <p className="caption" style={{ marginTop: 10, maxWidth: 360 }}>
          {verdict.label === 'benchmarkable' && 'Residual and sample size both clear thresholds. A derivative referencing this slice has survivable basis risk.'}
          {verdict.label === 'marginal' && 'Sample or residual sits between thresholds. Treat as indicative; quote wider spreads.'}
          {verdict.label === 'insufficient' && 'Either the slice is too narrow to have statistical power, or the residual is so large the slice isn\'t meaningfully fungible.'}
        </p>
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Residual</div>
        <div className="mono" style={{ fontSize: 40, color: 'var(--residual)', letterSpacing: '-0.02em' }}>{(verdict.residual*100).toFixed(0)}%</div>
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Sample size</div>
        <div className="mono" style={{ fontSize: 40, color: 'var(--ink-hi)', letterSpacing: '-0.02em' }}>{verdict.sample.toLocaleString()}</div>
        <div className="caption" style={{ marginTop: 4 }}>offers in slice</div>
      </div>
    </div>
  );
}
function Threshold({ label, val, ok, marginal, thresholds, invert }) {
  const tone = ok ? 'ok' : marginal ? 'warn' : 'bad';
  const glyph = ok ? '✓' : marginal ? '△' : '✕';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 40px', gap: 16, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line-lo)' }}>
      <div className="eyebrow">{label}</div>
      <div className="mono" style={{ fontSize: 15, color: 'var(--ink-hi)' }}>{val}</div>
      <div className="caption mono">{thresholds}</div>
      <div className="mono" style={{ fontSize: 16, color: `var(--verdict-${tone})` }}>{glyph}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function RollingPage() {
  const D = window.BASIS_DATA;
  const [mode, setMode] = useState('raw'); // raw | 7d | 30d
  const data = useMemo(() => {
    const src = D.ROLLING_H100;
    if (mode === 'raw') return src;
    const n = mode === '7d' ? 7 : 30;
    return src.map((d, i) => {
      const slice = src.slice(Math.max(0, i - n + 1), i + 1);
      const mean = slice.reduce((s,x)=>s+x.pct,0)/slice.length;
      return { ...d, pct: mean };
    });
  }, [mode, D]);

  return (
    <div className="page-wide fade-up">
      <section style={{ padding: '36px 0 10px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>06 · Rolling stability</div>
        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 40 }}>
          <h1 className="display" style={{ fontSize: 44, margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--ink-hi)' }}>
            Residual <em style={{ fontStyle: 'italic', color: 'var(--ink-mid)' }}>isn't a constant.</em> It moves with the market.
          </h1>
          <div className="chip-group" style={{ display: 'flex', gap: 4 }}>
            {[['raw','Daily'],['7d','7-day mean'],['30d','30-day mean']].map(([k,l]) =>
              <button key={k} onClick={() => setMode(k)} className={`chip ${mode===k?'on':''}`}>{l}</button>
            )}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 28 }}>
        <div className="panel" style={{ padding: '20px 10px 8px' }}>
          <RollingLine data={data} regimes={D.REGIMES} height={380} showBand={mode === 'raw'} />
        </div>
      </section>

      <section style={{ paddingTop: 32 }}>
        <div className="sec-eyebrow"><span className="num">02</span><h2>Regime log</h2></div>
        <div className="panel">
          <table className="tbl">
            <thead><tr><th style={{ width: 140 }}>Date</th><th style={{ width: 140 }}>Kind</th><th>Event</th></tr></thead>
            <tbody>
              {D.REGIMES.map(r => (
                <tr key={r.date}>
                  <td className="mono" style={{ fontSize: 11 }}>{r.date}</td>
                  <td className="mono caption" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{r.kind}</td>
                  <td>{r.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ paddingTop: 40 }}>
        <div className="sec-eyebrow"><span className="num">03</span><h2>Factor stability · 60 days</h2></div>
        <p className="caption" style={{ maxWidth: 720, margin: '-8px 0 18px' }}>
          How much variance each observable factor accounts for, day by day. Stability of these would imply the residual is structural. Drift implies the market itself is changing.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {D.FACTOR_STABILITY.map(s => (
            <TinyLine key={s.key} data={s.series} label={s.label} yMax={0.3} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function DispersionPage() {
  const D = window.BASIS_DATA;
  return (
    <div className="page-wide fade-up">
      <section style={{ padding: '36px 0 10px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>02 · Dispersion</div>
        <h1 className="display" style={{ fontSize: 44, margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          H100 SXM price, <em style={{ color: 'var(--ink-mid)' }}>p10 – p50 – p90</em>
        </h1>
        <p className="caption" style={{ marginTop: 10, maxWidth: 620 }}>The 15× spread on a single SKU is the whole story. Residual accounts for why.</p>
      </section>
      <section style={{ paddingTop: 24 }}>
        <div className="panel" style={{ padding: '18px 10px 8px' }}>
          <DispersionFan data={D.DISPERSION_H100} height={380} />
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function ProvidersPage() {
  const D = window.BASIS_DATA;
  return (
    <div className="page-wide fade-up">
      <section style={{ padding: '36px 0 24px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>07 · Providers</div>
        <h1 className="display" style={{ fontSize: 40, margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          Four providers, <em style={{ color: 'var(--ink-mid)' }}>four postures.</em>
        </h1>
      </section>
      <div className="panel" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead><tr>
            <th>Provider</th><th>Type</th>
            <th style={{ textAlign: 'right' }}>Offers</th>
            <th style={{ textAlign: 'right' }}>SKU coverage</th>
            <th style={{ textAlign: 'right' }}>Median Δ vs market</th>
            <th style={{ textAlign: 'right' }}>UNKNOWN rate</th>
            <th>Freshness</th>
          </tr></thead>
          <tbody>
            {D.PROVIDERS.map(p => (
              <tr key={p.id}>
                <td><span style={{ color: 'var(--ink-hi)' }}>{p.label}</span></td>
                <td className="caption">{p.type}</td>
                <td className="num" style={{ textAlign: 'right' }}>{p.offers.toLocaleString()}</td>
                <td className="num" style={{ textAlign: 'right' }}>{p.coverage}%</td>
                <td className="num" style={{ textAlign: 'right', color: p.medDev > 0 ? 'var(--verdict-warn)' : 'var(--verdict-ok)' }}>
                  {p.medDev > 0 ? '+' : ''}{(p.medDev*100).toFixed(0)}%
                </td>
                <td className="num" style={{ textAlign: 'right' }}>{(p.unknownPct*100).toFixed(1)}%</td>
                <td className="mono caption">{p.freshness} ago</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function MethodologyPage() {
  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <section style={{ padding: '36px 0 8px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>08 · Methodology</div>
        <h1 className="display" style={{ fontSize: 48, margin: 0, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
          Methodology
        </h1>
      </section>
      <div style={{ fontFamily: 'var(--f-serif)', fontSize: 17, lineHeight: 1.7, color: 'var(--ink-mid)' }}>
        <p><span style={{ color: 'var(--ink-hi)' }}>Basis</span> is a variance-accounting exercise. For each canonical SKU we collect quoted GPU prices from four providers — Vast.ai, RunPod, AWS EC2 Spot, TensorDock — every few minutes, over a rolling 60-day window.</p>
        <h3 className="serif" style={{ marginTop: 32, color: 'var(--ink-hi)', fontWeight: 400 }}>Normalization</h3>
        <p>Raw offers land in a canonical schema only when the mapping is <em>confident</em>. Ambiguous fields remain <span className="pill-unknown">UNKNOWN</span>. This is conservative on purpose: a permissive mapping would understate the residual by laundering noise into &ldquo;region&rdquo; or &ldquo;bundle.&rdquo;</p>
        <h3 className="serif" style={{ marginTop: 32, color: 'var(--ink-hi)', fontWeight: 400 }}>Decomposition</h3>
        <p>We regress <span className="mono" style={{ fontSize: 14 }}>log(price)</span> on four factors (provider, commitment, region, bundle) with a fixed-effects OLS. The share of total variance attributable to each factor is taken from the Type-II SS. Residual is <span className="mono" style={{ fontSize: 14 }}>1 − R²</span> — everything unexplained.</p>
        <h3 className="serif" style={{ marginTop: 32, color: 'var(--ink-hi)', fontWeight: 400 }}>What the residual is</h3>
        <p>Host-level pricing idiosyncrasy, hardware revision drift, reputation effects, timing within-day, stale listings, bait prices. Real causes — but unobservable from the quote schema alone.</p>
        <h3 className="serif" style={{ marginTop: 32, color: 'var(--ink-hi)', fontWeight: 400 }}>What the residual isn't</h3>
        <p>Statistical noise. If the residual were measurement error, it would not move coherently with market events (see <a onClick={() => (window.location.hash = '#/rolling')} style={{ color: 'var(--residual)', cursor: 'pointer' }}>Rolling Stability</a>). It moves; therefore it's signal.</p>
      </div>
    </div>
  );
}

Object.assign(window, { SlicePage, RollingPage, DispersionPage, ProvidersPage, MethodologyPage });
