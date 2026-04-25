/* global React */
// Basis — shared UI primitives

const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;

// Context: current SKU selection, cross-page
const BasisCtx = createContext(null);
function BasisProvider({ children }) {
  const [skuId, setSkuId] = useState('h100_sxm_80gb');
  const [route, setRoute] = useState(() => {
    const h = window.location.hash.replace('#/', '').split('?')[0];
    return h || 'findings';
  });
  const [drilldown, setDrilldown] = useState(null); // { level, obsId? }
  const [tweaks, setTweaks] = useState({
    residualHue: 'amber',
    serif: 'fraunces',
    density: 'default',
    navShape: 'grouped',
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-density', tweaks.density);
    const hueMap = { amber:'#f59e0b', red:'#ef4444', orange:'#f97316', cyan:'#22d3ee', lime:'#a3e635', white:'#e4e4e7' };
    const hue = hueMap[tweaks.residualHue] || '#f59e0b';
    document.documentElement.style.setProperty('--residual', hue);
    document.documentElement.style.setProperty('--residual-bg', hex(hue, 0.12));
    document.documentElement.style.setProperty('--residual-line', hex(hue, 0.38));
    const serifMap = {
      fraunces: '"Fraunces", Georgia, serif',
      instrument: '"Instrument Serif", Georgia, serif',
      source: '"Source Serif 4", Georgia, serif',
      none: '"Inter", sans-serif',
    };
    document.documentElement.style.setProperty('--f-serif', serifMap[tweaks.serif] || serifMap.fraunces);
  }, [tweaks]);

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#/', '').split('?')[0];
      if (h) setRoute(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const nav = useCallback((r) => { window.location.hash = `#/${r}`; setRoute(r); }, []);

  const sku = window.BASIS_DATA.SKUS.find(s => s.id === skuId);

  return <BasisCtx.Provider value={{ skuId, setSkuId, sku, route, nav, drilldown, setDrilldown, tweaks, setTweaks }}>{children}</BasisCtx.Provider>;
}
function useBasis() { return useContext(BasisCtx); }

function hex(h, a) {
  const x = h.replace('#','');
  const r = parseInt(x.slice(0,2),16), g = parseInt(x.slice(2,4),16), b = parseInt(x.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ─────────────────────────────────────────────────────────────
// TopBar — Findings · Explore ▾ (Dispersion/Basis/Slice/Rolling) · Providers · Methodology
// Persistent SKU pill on the right.
// ─────────────────────────────────────────────────────────────
function TopBar() {
  const { route, nav, sku, tweaks } = useBasis();
  const [explOpen, setExplOpen] = useState(false);
  const [skuOpen, setSkuOpen] = useState(false);
  const explRef = useRef(null);
  const skuRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (explRef.current && !explRef.current.contains(e.target)) setExplOpen(false);
      if (skuRef.current && !skuRef.current.contains(e.target)) setSkuOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const exploreRoutes = ['dispersion','basis','slice','rolling'];
  const isExplore = exploreRoutes.includes(route);

  const flat = tweaks.navShape === 'flat';
  const links = flat
    ? [['findings','Findings'],['dispersion','Dispersion'],['basis','Basis'],['slice','Slice Builder'],['rolling','Rolling'],['providers','Providers'],['methodology','Methodology']]
    : [['findings','Findings']];

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(17,24,39,0.82)', backdropFilter: 'saturate(1.2) blur(12px)',
      borderBottom: '1px solid var(--line)',
    }}>
      <div style={{ maxWidth: 1480, margin: '0 auto', padding: '0 40px', display: 'flex', alignItems: 'center', gap: 28 }}>
        {/* Wordmark */}
        <button onClick={() => nav('findings')} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '16px 0' }}>
          <span style={{ fontFamily: 'var(--f-serif)', fontSize: 19, letterSpacing: '-0.01em', color: 'var(--ink-hi)' }}>Basis</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-dim)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>v2 · research</span>
        </button>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 24, marginLeft: 8 }}>
          {links.map(([k,l]) => (
            <button key={k} className={`nav-link ${route === k ? 'active' : ''}`} onClick={() => nav(k)}>{l}</button>
          ))}

          {!flat && (
            <div ref={explRef} style={{ position: 'relative' }}>
              <button
                className={`nav-link ${isExplore ? 'active' : ''}`}
                onClick={() => setExplOpen(o => !o)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                Explore
                <span className="mono" style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
              </button>
              {explOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: -12, marginTop: -1,
                  background: 'var(--panel)', border: '1px solid var(--line-hi)',
                  borderRadius: 'var(--r-md)', minWidth: 260, padding: 6,
                  boxShadow: 'var(--shadow-md)',
                }}>
                  {[
                    ['dispersion','Dispersion',  'p25 / median / p75 over time'],
                    ['basis',     'Basis Decomposition', 'variance → explained + residual'],
                    ['slice',     'Slice Builder',       'filter → live benchmarkability'],
                    ['rolling',   'Rolling Stability',   'residual time series + regimes'],
                  ].map(([k,l,sub]) => (
                    <button key={k} onClick={() => { setExplOpen(false); nav(k); }} style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
                      borderRadius: 4, background: route === k ? 'var(--panel-hi)' : 'transparent',
                    }} onMouseEnter={e => { if (route !== k) e.currentTarget.style.background = 'var(--panel-lo)'; }}
                       onMouseLeave={e => { if (route !== k) e.currentTarget.style.background = 'transparent'; }}>
                      <div style={{ color: 'var(--ink)', fontSize: 13 }}>{l}</div>
                      <div className="caption" style={{ marginTop: 2 }}>{sub}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!flat && <button className={`nav-link ${route === 'providers' ? 'active' : ''}`} onClick={() => nav('providers')}>Providers</button>}
          {!flat && <button className={`nav-link ${route === 'methodology' ? 'active' : ''}`} onClick={() => nav('methodology')}>Methodology</button>}
        </nav>

        <div style={{ flex: 1 }} />

        {/* SKU pill */}
        <div ref={skuRef} style={{ position: 'relative' }}>
          <button onClick={() => setSkuOpen(o => !o)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '7px 10px 7px 12px',
            border: '1px solid var(--line-hi)', borderRadius: 'var(--r-sm)',
            background: 'var(--panel-lo)',
          }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>SKU</span>
            <span className="mono" style={{ color: 'var(--ink-hi)', fontSize: 12 }}>{sku.id}</span>
            <span className="mono" style={{ fontSize: 9, color: 'var(--ink-dim)' }}>▾</span>
          </button>
          {skuOpen && <SkuPicker onClose={() => setSkuOpen(false)} />}
        </div>

        <TweakToggle />
      </div>
    </header>
  );
}

function SkuPicker({ onClose }) {
  const { skuId, setSkuId } = useBasis();
  const [q, setQ] = useState('');
  const skus = window.BASIS_DATA.SKUS;
  const filtered = useMemo(() => skus.filter(s => s.label.toLowerCase().includes(q.toLowerCase()) || s.id.includes(q.toLowerCase())), [q, skus]);

  return (
    <div style={{
      position: 'absolute', top: '100%', right: 0, marginTop: 6,
      width: 380, background: 'var(--panel)', border: '1px solid var(--line-hi)',
      borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-md)', zIndex: 60,
    }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line-lo)' }}>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search SKU…"
          className="mono"
          style={{ width: '100%', border: 'none', background: 'transparent', color: 'var(--ink)', outline: 'none', fontSize: 13 }} />
      </div>
      <div style={{ maxHeight: 380, overflow: 'auto' }}>
        <div className="eyebrow" style={{ padding: '10px 12px 6px' }}>Sorted by offer count</div>
        {filtered.map(s => (
          <button key={s.id} onClick={() => { setSkuId(s.id); onClose(); }} style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 12,
            width: '100%', padding: '9px 12px', textAlign: 'left',
            background: skuId === s.id ? 'var(--panel-hi)' : 'transparent',
            borderLeft: skuId === s.id ? '2px solid var(--residual)' : '2px solid transparent',
          }}
            onMouseEnter={e => { if (skuId !== s.id) e.currentTarget.style.background = 'var(--panel-lo)'; }}
            onMouseLeave={e => { if (skuId !== s.id) e.currentTarget.style.background = 'transparent'; }}
          >
            <div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--ink-hi)' }}>{s.id}</div>
              <div className="caption" style={{ fontSize: 11, marginTop: 2 }}>{s.label} · {s.family}</div>
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-mid)' }}>{s.offers.toLocaleString()}</div>
            {s.insufficient
              ? <span className="pill-unknown" title="thin data">THIN</span>
              : <span className="mono" style={{ fontSize: 11, color: 'var(--residual)' }}>{(s.residual*100).toFixed(0)}%</span>}
          </button>
        ))}
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--line-lo)', display: 'flex', justifyContent: 'space-between' }}>
        <span className="caption">{filtered.length} of {skus.length}</span>
        <span className="caption mono">residual %</span>
      </div>
    </div>
  );
}

function TweakToggle() {
  const { tweaks } = useBasis();
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onMsg = (e) => {
      if (!e.data) return;
      if (e.data.type === '__activate_edit_mode') setOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    setAvailable(true);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  if (!open) return null;
  return <TweakPanel onClose={() => setOpen(false)} />;
}

function TweakPanel({ onClose }) {
  const { tweaks, setTweaks } = useBasis();
  const set = (k, v) => {
    setTweaks(t => ({ ...t, [k]: v }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
  };

  return (
    <div style={{
      position: 'fixed', right: 16, bottom: 16, width: 280, zIndex: 200,
      background: 'var(--panel)', border: '1px solid var(--line-hi)',
      borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-md)',
      fontSize: 12,
    }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line-lo)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="eyebrow" style={{ color: 'var(--ink)' }}>Tweaks</span>
        <button onClick={onClose} style={{ color: 'var(--ink-dim)' }}>×</button>
      </div>
      <div style={{ padding: 12, display: 'grid', gap: 14 }}>
        <TweakGroup label="Residual accent (used nowhere else)">
          <div style={{ display: 'flex', gap: 6 }}>
            {['amber','red','orange','cyan','lime','white'].map(h => (
              <button key={h} onClick={() => set('residualHue', h)} style={{
                width: 24, height: 24, borderRadius: 3,
                background: { amber:'#f59e0b', red:'#ef4444', orange:'#f97316', cyan:'#22d3ee', lime:'#a3e635', white:'#e4e4e7' }[h],
                border: tweaks.residualHue === h ? '2px solid var(--ink-hi)' : '1px solid var(--line-hi)',
              }} title={h} />
            ))}
          </div>
        </TweakGroup>
        <TweakGroup label="Serif">
          {[['fraunces','Fraunces'],['instrument','Instrument Serif'],['source','Source Serif 4'],['none','Sans only']].map(([k,l]) => (
            <RadioRow key={k} on={tweaks.serif === k} label={l} onClick={() => set('serif', k)} />
          ))}
        </TweakGroup>
        <TweakGroup label="Density">
          {[['tight','Tight'],['default','Default'],['loose','Loose']].map(([k,l]) => (
            <RadioRow key={k} on={tweaks.density === k} label={l} onClick={() => set('density', k)} />
          ))}
        </TweakGroup>
        <TweakGroup label="Nav shape">
          {[['grouped','Grouped (Findings · Explore ▾ · Providers · Methodology)'],['flat','Flat (all 7 visible)']].map(([k,l]) => (
            <RadioRow key={k} on={tweaks.navShape === k} label={l} onClick={() => set('navShape', k)} />
          ))}
        </TweakGroup>
      </div>
    </div>
  );
}
function TweakGroup({ label, children }) {
  return <div><div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div><div style={{ display: 'grid', gap: 4 }}>{children}</div></div>;
}
function RadioRow({ on, label, onClick }) {
  return <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 3, background: on ? 'var(--panel-hi)' : 'transparent', textAlign: 'left' }}>
    <span style={{ width: 10, height: 10, borderRadius: 5, border: '1px solid var(--line-hi)', background: on ? 'var(--residual)' : 'transparent', flexShrink: 0 }} />
    <span style={{ fontSize: 12, color: on ? 'var(--ink-hi)' : 'var(--ink-mid)' }}>{label}</span>
  </button>;
}

// Utility: residual color scale for heatmap (0 → dim, 1 → full)
function residualShade(v) {
  // v in [0,1] → alpha
  const a = 0.08 + Math.min(1, Math.max(0, v)) * 0.78;
  const h = getComputedStyle(document.documentElement).getPropertyValue('--residual').trim() || '#f59e0b';
  return hex(h, a);
}

// Factor color
function factorColor(k) {
  return ({
    provider:   'var(--factor-provider)',
    commitment: 'var(--factor-commitment)',
    region:     'var(--factor-region)',
    bundle:     'var(--factor-bundle)',
    residual:   'var(--residual)',
  })[k];
}

Object.assign(window, {
  BasisProvider, useBasis, TopBar, hex, residualShade, factorColor,
});
