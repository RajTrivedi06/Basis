/* global React */
// Basis — Landing / Findings page

function FindingsPage() {
  const { nav, sku, setSkuId } = useBasis();
  const D = window.BASIS_DATA;
  const [sort, setSort] = useState({ key: 'offers', dir: 'desc' });
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const filt = D.SKUS.filter(s => s.label.toLowerCase().includes(q.toLowerCase()));
    const sorted = filt.slice().sort((a,b) => {
      const av = a[sort.key] ?? -1, bv = b[sort.key] ?? -1;
      return sort.dir === 'desc' ? bv - av : av - bv;
    });
    return sorted;
  }, [q, sort, D.SKUS]);

  const setS = (k) => setSort(s => s.key === k ? { key: k, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key: k, dir: 'desc' });
  const arrow = (k) => sort.key === k ? (sort.dir === 'desc' ? '↓' : '↑') : '';

  return (
    <div className="page-wide fade-up">
      {/* Hero */}
      <section style={{ padding: '40px 0 36px', borderBottom: '1px solid var(--line-lo)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 64, alignItems: 'start' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 18 }}>Finding · H100 SXM 80GB · 60-day window</div>
            <h1 className="display" style={{ fontSize: 'clamp(56px, 7.4vw, 112px)', lineHeight: 0.96, margin: 0, color: 'var(--ink-hi)', letterSpacing: '-0.03em' }}>
              <span style={{ color: 'var(--residual)' }}>53–95%</span><br/>
              <span style={{ fontStyle: 'italic', fontWeight: 300 }}>of log-price<br/>variance is<br/>unexplained.</span>
            </h1>
            <p style={{ maxWidth: 560, marginTop: 32, fontSize: 16, lineHeight: 1.55, color: 'var(--ink-mid)' }}>
              After controlling for the four observable factors — <span style={{ color: 'var(--ink)' }}>provider identity, commitment type, region, bundled resources</span> — a residual this large remains. That residual is the basis risk any compute benchmark has to live with.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              <button className="btn primary" onClick={() => nav('basis')}>See the decomposition →</button>
              <button className="btn ghost" onClick={() => nav('methodology')}>Methodology</button>
            </div>
          </div>

          {/* Anchor snapshots */}
          <div className="panel" style={{ padding: 22 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Residual share · by day</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {D.RESIDUAL_SNAPSHOTS.map(s => (
                <div key={s.date} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 64px', alignItems: 'center', gap: 14 }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-dim)' }}>{s.date}</span>
                  <div style={{ height: 22, background: 'var(--panel-hi)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${s.pct*100}%`, background: 'var(--residual)' }} />
                  </div>
                  <span className="mono" style={{ fontSize: 13, color: 'var(--residual)', textAlign: 'right' }}>{(s.pct*100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-lo)', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              <Stat label="Observations" val={D.FINDINGS_SHORT.totalObs.toLocaleString()} />
              <Stat label="Canonical SKUs" val={D.FINDINGS_SHORT.skusCovered} />
              <Stat label="Providers" val={D.FINDINGS_SHORT.providers} />
            </div>
          </div>
        </div>
      </section>

      {/* Fungibility matrix */}
      <section style={{ paddingTop: 40 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>01 · Fungibility matrix</div>
            <h2 className="serif" style={{ fontSize: 28, fontWeight: 400, margin: 0, letterSpacing: '-0.01em' }}>
              How interchangeable is <span style={{ color: 'var(--residual)' }}>each SKU</span>?
            </h2>
            <p className="caption" style={{ marginTop: 6, maxWidth: 620 }}>
              A low residual means the market agrees on price given observable features. A high residual means it doesn't — and the SKU is a poor benchmark target.
            </p>
          </div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter SKU…" className="mono" style={{
            padding: '7px 10px', border: '1px solid var(--line-hi)', background: 'var(--panel-lo)', color: 'var(--ink)',
            borderRadius: 3, fontSize: 12, width: 200, outline: 'none',
          }} />
        </div>

        <div className="panel" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 220 }}><button onClick={() => setS('label')}>SKU {arrow('label')}</button></th>
                  <th style={{ textAlign: 'right' }}><button onClick={() => setS('offers')}>Offers {arrow('offers')}</button></th>
                  <th style={{ textAlign: 'right' }}><button onClick={() => setS('providers')}>Providers {arrow('providers')}</button></th>
                  <th style={{ textAlign: 'right' }}><button onClick={() => setS('medianPrice')}>Median $/hr {arrow('medianPrice')}</button></th>
                  <th style={{ textAlign: 'right' }}>Range</th>
                  <th style={{ textAlign: 'center', width: 120 }}>
                    <button onClick={() => setS('residual')} style={{ color: 'var(--residual)' }}>Residual {arrow('residual')}</button>
                  </th>
                  <th style={{ width: 140 }}>Residual · 60d</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(s => (
                  <MatrixRow key={s.id} s={s} onOpen={() => { setSkuId(s.id); nav('basis'); }} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Caveats */}
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {[
            ['Conservative normalization', 'When a field can\'t be reliably mapped, it stays UNKNOWN. The residual is what remains after only confident inferences.'],
            ['Observed, not fitted',       'Factor shares are from a fixed-effects OLS on log price. Non-linear interactions would shift them, but not by the order of magnitude the residual implies.'],
            ['Not a price forecast',       'This is variance accounting. If you want to predict next-hour prices, use a different tool.'],
          ].map(([t, body]) => (
            <div key={t} className="panel" style={{ padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>{t}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.55 }}>{body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MatrixRow({ s, onOpen }) {
  // synth a tiny sparkline — amplitude proportional to residual
  const spark = useMemo(() => {
    if (s.residual == null) return null;
    const arr = [];
    for (let i = 0; i < 28; i++) {
      arr.push(s.residual + Math.sin(i * 0.4 + (s.id.length % 7)) * 0.07 + (i === 14 ? 0.04 : 0));
    }
    return arr;
  }, [s.id, s.residual]);

  const thin = s.insufficient;

  return (
    <tr onClick={onOpen} style={{ cursor: 'pointer' }}>
      <td>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="mono" style={{ fontSize: 12, color: 'var(--ink-hi)' }}>{s.id}</span>
          <span className="badge">{s.family}</span>
        </div>
      </td>
      <td className="num" style={{ textAlign: 'right', color: 'var(--ink)' }}>{s.offers.toLocaleString()}</td>
      <td className="num" style={{ textAlign: 'right', color: 'var(--ink-mid)' }}>{s.providers}</td>
      <td className="num" style={{ textAlign: 'right', color: 'var(--ink)' }}>${s.medianPrice.toFixed(2)}</td>
      <td className="num" style={{ textAlign: 'right', color: 'var(--ink-dim)', fontSize: 11 }}>${s.priceMin.toFixed(2)}–${s.priceMax.toFixed(2)}</td>
      <td style={{ textAlign: 'center' }}>
        {thin
          ? <span className="pill-unknown">Thin · {s.daysCollected}d</span>
          : <ResidualCell v={s.residual} />}
      </td>
      <td>
        {thin
          ? <span className="caption" style={{ fontSize: 10 }}>accumulating…</span>
          : <Sparkline data={spark} width={120} height={22} />
        }
      </td>
      <td style={{ textAlign: 'right', color: 'var(--ink-dim)' }}>
        <span className="mono" style={{ fontSize: 11 }}>→</span>
      </td>
    </tr>
  );
}

function ResidualCell({ v }) {
  const pct = v * 100;
  // gradient fill proportional to residual
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 92 }}>
      <div style={{ width: 54, height: 6, background: 'var(--panel-hi)', borderRadius: 1, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--residual)' }} />
      </div>
      <span className="mono" style={{ fontSize: 12, color: 'var(--residual)' }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function Stat({ label, val }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 20, color: 'var(--ink-hi)', letterSpacing: '-0.01em' }}>{val}</div>
    </div>
  );
}

Object.assign(window, { FindingsPage });
