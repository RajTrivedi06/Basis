/* global React */
// Basis — Basis Decomposition page + Provenance drilldown

function BasisPage() {
  const { skuId, sku, setDrilldown } = useBasis();
  const D = window.BASIS_DATA;
  const decomp = D.DECOMPS[skuId] || D.DECOMPS.h100_sxm_80gb;

  return (
    <div className="page-wide fade-up">
      <section style={{ padding: '36px 0 20px', borderBottom: '1px solid var(--line-lo)' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>03 · Basis decomposition</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 56, alignItems: 'end' }}>
          <h1 className="display" style={{ fontSize: 48, margin: 0, lineHeight: 1.05, letterSpacing: '-0.02em', color: 'var(--ink-hi)' }}>
            What share of log-price variance do <em style={{ fontStyle: 'italic', color: 'var(--ink-mid)' }}>observable factors</em> explain?
          </h1>
          <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
            <span className="eyebrow">Window · 60d</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink-mid)' }}>{sku.id} · {sku.offers.toLocaleString()} observations</span>
          </div>
        </div>
      </section>

      {/* The residual-first bar — hero element */}
      <section style={{ paddingTop: 36 }}>
        <DecompBar decomp={decomp} height={128} />
        <div className="caption" style={{ marginTop: 16, maxWidth: 720 }}>
          The bar is read in proportions of total log-price variance <span className="mono" style={{ color: 'var(--ink)' }}>({decomp.total.toFixed(3)})</span>. Four observable factors account for <span className="mono" style={{ color: 'var(--ink)' }}>{((1-decomp.residual)*100).toFixed(1)}%</span>. The remainder is residual.
        </div>
      </section>

      {/* Factor table with drilldown */}
      <section style={{ paddingTop: 40 }}>
        <div className="sec-eyebrow">
          <span className="num">02</span>
          <h2>Factor contributions</h2>
        </div>
        <div className="panel" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 200 }}>Factor</th>
                <th style={{ width: 120, textAlign: 'right' }}>Share</th>
                <th style={{ width: 240 }}>Cumulative</th>
                <th>Note</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              <FactorRow k="provider" label="Provider identity" share={decomp.provider} cum={decomp.provider} note="4 providers; pricing power asymmetry" onDrill={() => setDrilldown({ level: 2 })} />
              <FactorRow k="commitment" label="Commitment type" share={decomp.commitment} cum={decomp.provider + decomp.commitment} note="on_demand vs spot vs reserved_1y" onDrill={() => setDrilldown({ level: 2 })} />
              <FactorRow k="region" label="Region" share={decomp.region} cum={decomp.provider + decomp.commitment + decomp.region} note="us-east-1 anchor; sparse outside" onDrill={() => setDrilldown({ level: 2 })} />
              <FactorRow k="bundle" label="Bundled resources" share={decomp.bundle} cum={decomp.provider + decomp.commitment + decomp.region + decomp.bundle} note="vCPU, RAM, NVMe, interconnect" onDrill={() => setDrilldown({ level: 2 })} />
              <tr style={{ background: 'color-mix(in srgb, var(--residual) 4%, transparent)' }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, background: 'var(--residual)', borderRadius: 1 }} />
                    <span className="mono" style={{ color: 'var(--residual)', fontSize: 13, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Residual</span>
                  </div>
                </td>
                <td className="num" style={{ textAlign: 'right', color: 'var(--residual)', fontSize: 15, fontWeight: 600 }}>{(decomp.residual*100).toFixed(1)}%</td>
                <td></td>
                <td className="caption">Everything the four observable factors do not explain.</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn" onClick={() => setDrilldown({ level: 2 })} style={{ color: 'var(--residual)', borderColor: 'var(--residual-line)' }}>Inspect →</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Comparison: why not a donut */}
      <section style={{ paddingTop: 40 }}>
        <div className="sec-eyebrow"><span className="num">03</span><h2>Compare to an equal-weight donut</h2></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="panel" style={{ padding: 22 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>v1 · donut (misleading)</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <DonutBad decomp={decomp} />
            </div>
            <p className="caption" style={{ marginTop: 14, lineHeight: 1.5 }}>A donut implicitly equal-weights each slice's visual footprint. Residual reads as "another slice."</p>
          </div>
          <div className="panel" style={{ padding: 22 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>v2 · residual-first bar</div>
            <DecompBar decomp={decomp} height={60} showLabels={false} />
            <p className="caption" style={{ marginTop: 14, lineHeight: 1.5 }}>A stacked bar preserves proportionality. Residual dominates — which is the point.</p>
          </div>
        </div>
      </section>

      <ProvenanceDrawer />
    </div>
  );
}

function FactorRow({ k, label, share, cum, note, onDrill }) {
  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, background: factorColor(k), borderRadius: 1 }} />
          <span style={{ color: 'var(--ink)' }}>{label}</span>
        </div>
      </td>
      <td className="num" style={{ textAlign: 'right', color: 'var(--ink)' }}>{(share*100).toFixed(1)}%</td>
      <td>
        <div style={{ height: 6, background: 'var(--panel-hi)', borderRadius: 1, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${cum*100}%`, background: factorColor(k) }} />
        </div>
      </td>
      <td className="caption" style={{ fontSize: 12 }}>{note}</td>
      <td style={{ textAlign: 'right' }}>
        <button className="btn ghost" onClick={onDrill}>View →</button>
      </td>
    </tr>
  );
}

function DonutBad({ decomp }) {
  const factors = [
    ['provider', decomp.provider],['commitment', decomp.commitment],
    ['region', decomp.region],['bundle', decomp.bundle],['residual', decomp.residual],
  ];
  const total = factors.reduce((s, [,v]) => s + v, 0);
  const R = 70, CX = 100, CY = 100;
  let a = -Math.PI/2;
  const arcs = factors.map(([k, v]) => {
    const frac = v / total;
    const a0 = a, a1 = a + frac * Math.PI * 2;
    a = a1;
    const x0 = CX + R * Math.cos(a0), y0 = CY + R * Math.sin(a0);
    const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1);
    const large = frac > 0.5 ? 1 : 0;
    return { k, d: `M ${CX} ${CY} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z` };
  });
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {arcs.map((a, i) => <path key={i} d={a.d} fill={a.k === 'residual' ? 'var(--residual)' : factorColor(a.k)} stroke="var(--panel-lo)" strokeWidth="1.5" />)}
      <circle cx={CX} cy={CY} r="36" fill="var(--panel-lo)" />
    </svg>
  );
}

// Provenance drilldown — slide-in drawer
function ProvenanceDrawer() {
  const { drilldown, setDrilldown, skuId } = useBasis();
  const D = window.BASIS_DATA;

  if (!drilldown) return null;

  const offers = D.H100_OFFERS;

  return (
    <div onClick={() => setDrilldown(null)} style={{
      position: 'fixed', inset: 0, background: 'rgba(8,12,20,0.6)', backdropFilter: 'blur(6px)',
      zIndex: 100, display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: drilldown.level === 3 ? 1100 : 760, maxWidth: '95vw', height: '100%',
        background: 'var(--bg)', borderLeft: '1px solid var(--line-hi)',
        overflowY: 'auto', animation: 'fadeUp .3s ease both',
      }}>
        {/* Fixed summary bar */}
        <div style={{ position: 'sticky', top: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line-lo)', zIndex: 1, padding: '14px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="eyebrow">Drilldown</span>
            <Breadcrumb level={drilldown.level} skuId={skuId} onGo={(lv) => setDrilldown({ level: lv, obsId: lv === 3 ? drilldown.obsId : undefined })} />
            <div style={{ flex: 1 }} />
            <button onClick={() => setDrilldown(null)} style={{ color: 'var(--ink-dim)', fontSize: 18 }}>×</button>
          </div>
        </div>

        {drilldown.level === 2 && <OffersTable offers={offers} onOpen={(id) => setDrilldown({ level: 3, obsId: id })} />}
        {drilldown.level === 3 && <RawInspector obsId={drilldown.obsId || 'obs_8f12'} />}
      </div>
    </div>
  );
}

function Breadcrumb({ level, skuId, onGo }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
      <span className="mono" style={{ color: 'var(--ink-mid)' }}>aggregate</span>
      <span style={{ color: 'var(--ink-faint)' }}>›</span>
      <button onClick={() => onGo(2)} className="mono" style={{ color: level >= 2 ? 'var(--ink)' : 'var(--ink-mid)' }}>canonical offers</button>
      {level === 3 && <>
        <span style={{ color: 'var(--ink-faint)' }}>›</span>
        <span className="mono" style={{ color: 'var(--ink-hi)' }}>raw observation</span>
      </>}
      <span className="mono" style={{ color: 'var(--ink-dim)', marginLeft: 10 }}>· {skuId}</span>
    </div>
  );
}

function OffersTable({ offers, onOpen }) {
  const provLabel = id => (window.BASIS_DATA.PROVIDERS.find(p => p.id === id) || {}).label || id;
  return (
    <div style={{ padding: 22 }}>
      <div style={{ marginBottom: 18 }}>
        <h2 className="serif" style={{ fontSize: 22, margin: 0, fontWeight: 400 }}>Canonical offers · h100_sxm_80gb</h2>
        <p className="caption" style={{ marginTop: 6 }}>After normalization. <span className="pill-unknown">UNKNOWN</span> cells are surfaced, never hidden.</p>
      </div>
      <div className="panel" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Obs</th>
              <th>Provider</th>
              <th>Region</th>
              <th>Commit</th>
              <th style={{ textAlign: 'right' }}>$/hr</th>
              <th style={{ textAlign: 'right' }}>vCPU</th>
              <th style={{ textAlign: 'right' }}>RAM</th>
              <th style={{ textAlign: 'right' }}>NVMe</th>
              <th>Verified</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {offers.map(o => (
              <tr key={o.id} onClick={() => onOpen(o.id)} style={{ cursor: 'pointer' }}>
                <td className="mono" style={{ fontSize: 11, color: 'var(--ink-mid)' }}>{o.id}</td>
                <td>{provLabel(o.provider)}</td>
                <td>{o.region === 'UNKNOWN' ? <span className="pill-unknown">UNKNOWN</span> : <span className="mono" style={{ fontSize: 11 }}>{o.region}</span>}</td>
                <td className="mono" style={{ fontSize: 11 }}>{o.commitment}</td>
                <td className="num" style={{ textAlign: 'right', color: 'var(--ink-hi)' }}>${o.price.toFixed(2)}</td>
                <td className="num" style={{ textAlign: 'right' }}>{o.vcpu == null ? <span className="pill-unknown">—</span> : o.vcpu}</td>
                <td className="num" style={{ textAlign: 'right' }}>{o.ram == null ? <span className="pill-unknown">—</span> : o.ram}</td>
                <td className="num" style={{ textAlign: 'right' }}>{o.nvme == null ? <span className="pill-unknown">—</span> : o.nvme}</td>
                <td>{o.verified ? <span className="glyph-check caption">yes</span> : <span className="caption" style={{ color: 'var(--ink-dim)' }}>no</span>}</td>
                <td className="mono" style={{ textAlign: 'right', color: 'var(--ink-dim)' }}>→</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RawInspector({ obsId }) {
  const raw = window.BASIS_DATA.RAW_OBS_8F12;
  return (
    <div style={{ padding: 22 }}>
      <div style={{ marginBottom: 18 }}>
        <h2 className="serif" style={{ fontSize: 22, margin: 0, fontWeight: 400 }}>Raw observation · {obsId}</h2>
        <p className="caption" style={{ marginTop: 6 }}>Every canonical field traces to a raw source and a documented decision.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div className="panel">
          <div className="panel-hd">
            <span className="eyebrow">Raw payload</span>
            <span className="mono caption">{raw.source}</span>
          </div>
          <pre className="mono" style={{ margin: 0, padding: 16, fontSize: 11, color: 'var(--ink-mid)', lineHeight: 1.55, overflow: 'auto' }}>
{JSON.stringify(raw.payload, null, 2)}
          </pre>
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line-lo)' }}>
            <span className="caption mono">fetched {raw.fetchedAt}</span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-hd">
            <span className="eyebrow">Decision trail</span>
            <span className="caption">{raw.decisions.length} rules applied</span>
          </div>
          <div>
            {raw.decisions.map((d, i) => (
              <div key={i} style={{ padding: '12px 16px', borderBottom: i < raw.decisions.length - 1 ? '1px solid var(--line-lo)' : 'none' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', minWidth: 90 }}>{d.field}</span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--ink-mid)' }}>{d.from}</span>
                  <span className="mono" style={{ color: 'var(--ink-faint)' }}>→</span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--ink-hi)' }}>{d.to}</span>
                </div>
                <div className="caption" style={{ marginTop: 5, marginLeft: 100, fontSize: 11 }}>{d.rule}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { BasisPage });
