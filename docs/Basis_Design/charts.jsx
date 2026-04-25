/* global React */
// Basis — chart primitives. Residual is always amber.

const { useState: useState2, useMemo: useMemo2 } = React;

// Sparkline (residual-colored)
function Sparkline({ data, width = 120, height = 22, stroke = 'var(--residual)', fill = 'var(--residual-bg)', showDot = true }) {
  if (!data || !data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const norm = (v, i) => [ (i / (data.length - 1)) * width, height - 2 - ((v - min) / (max - min || 1)) * (height - 4) ];
  const pts = data.map(norm);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = d + ` L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg className="spark" width={width} height={height}>
      <path d={area} fill={fill} />
      <path d={d} stroke={stroke} strokeWidth="1.25" fill="none" />
      {showDot && <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2" fill={stroke} />}
    </svg>
  );
}

// Heatmap cell — residual cell uses amber, factor cells use slate
function HeatCell({ v, kind = 'residual', label, style = {}, width = 60 }) {
  const val = typeof v === 'number' ? v : null;
  const isUnknown = val === null;
  let bg = 'transparent';
  if (!isUnknown) {
    if (kind === 'residual') {
      bg = `color-mix(in srgb, var(--residual) ${Math.round(10 + val * 70)}%, transparent)`;
    } else {
      bg = `color-mix(in srgb, var(--factor-${kind}) ${Math.round(10 + val * 70)}%, transparent)`;
    }
  }
  return (
    <div style={{
      width, height: 28, background: bg, borderRadius: 2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '1px solid var(--line-lo)',
      ...style,
    }} title={label}>
      {isUnknown ? <span className="pill-unknown" style={{ fontSize: 9 }}>—</span>
        : <span className="mono" style={{ fontSize: 11, color: 'var(--ink)' }}>{(val*100).toFixed(0)}%</span>}
    </div>
  );
}

// Residual-first decomposition bar
// A horizontal bar where residual (amber) is dominant on the RIGHT
// and the four muted factors stack on the LEFT in order.
function DecompBar({ decomp, height = 72, showLabels = true }) {
  // decomp: { provider, commitment, region, bundle, residual } — shares of total variance
  const factors = [
    { key: 'provider',   label: 'Provider',   v: decomp.provider },
    { key: 'commitment', label: 'Commitment', v: decomp.commitment },
    { key: 'region',     label: 'Region',     v: decomp.region },
    { key: 'bundle',     label: 'Bundle',     v: decomp.bundle },
  ];
  const residual = decomp.residual;
  const total = factors.reduce((s, f) => s + f.v, 0) + residual;

  return (
    <div>
      {showLabels && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="eyebrow">Explained</span>
          <span className="eyebrow" style={{ color: 'var(--residual)' }}>Residual · {(residual*100).toFixed(1)}%</span>
        </div>
      )}
      <div style={{ display: 'flex', height, borderRadius: 2, overflow: 'hidden', border: '1px solid var(--line)' }}>
        {factors.map(f => (
          <div key={f.key} style={{
            width: `${(f.v/total)*100}%`,
            background: factorColor(f.key),
            borderRight: '1px solid rgba(0,0,0,0.25)',
            position: 'relative',
            overflow: 'hidden',
          }} title={`${f.label}: ${(f.v*100).toFixed(1)}%`}>
            {f.v/total > 0.08 && (
              <div style={{ position: 'absolute', inset: 0, padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <span className="mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.95)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{f.label}</span>
                <span className="mono" style={{ fontSize: 13, color: 'rgba(255,255,255,0.95)' }}>{(f.v*100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        ))}
        <div style={{
          width: `${(residual/total)*100}%`,
          background: 'var(--residual)',
          position: 'relative',
          overflow: 'hidden',
        }} title={`Residual: ${(residual*100).toFixed(1)}%`}>
          <div style={{ position: 'absolute', inset: 0, padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--bg-deep)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>Residual · unexplained</span>
            <span className="mono" style={{ fontSize: 22, color: 'var(--bg-deep)', fontWeight: 700 }}>{(residual*100).toFixed(1)}%</span>
          </div>
        </div>
      </div>
      {showLabels && (
        <div style={{ display: 'flex', gap: 18, marginTop: 12, flexWrap: 'wrap' }}>
          {factors.map(f => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 1, background: factorColor(f.key) }} />
              <span className="caption">{f.label}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink)' }}>{(f.v*100).toFixed(1)}%</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 1, background: 'var(--residual)' }} />
            <span className="caption" style={{ color: 'var(--residual)' }}>Residual</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--residual)' }}>{(residual*100).toFixed(1)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Rolling residual line chart with confidence band
function RollingLine({ data, regimes = [], height = 320, showBand = true, showRegimes = true }) {
  const W = 1000;
  const H = height;
  const padL = 52, padR = 20, padT = 20, padB = 42;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = data.length;
  const yMin = 0, yMax = 1;

  const xAt = i => padL + (i / (n - 1)) * innerW;
  const yAt = v => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const linePath = data.map((d, i) => (i ? 'L' : 'M') + xAt(i).toFixed(1) + ' ' + yAt(d.pct).toFixed(1)).join(' ');
  const bandPath = [
    ...data.map((d, i) => (i ? 'L' : 'M') + xAt(i).toFixed(1) + ' ' + yAt(d.hi).toFixed(1)),
    ...data.slice().reverse().map((d, i) => 'L' + xAt(n-1-i).toFixed(1) + ' ' + yAt(d.lo).toFixed(1)),
    'Z'
  ].join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      {/* Grid */}
      {gridLines.map(g => (
        <g key={g}>
          <line x1={padL} x2={W - padR} y1={yAt(g)} y2={yAt(g)} stroke="var(--line-lo)" strokeDasharray={g === 0 || g === 1 ? '0' : '2 4'} />
          <text x={padL - 8} y={yAt(g) + 3} textAnchor="end" fontSize="10" fontFamily="var(--f-mono)" fill="var(--ink-dim)">{(g*100).toFixed(0)}%</text>
        </g>
      ))}

      {/* 50% reference — benchmarkability threshold */}
      <line x1={padL} x2={W - padR} y1={yAt(0.5)} y2={yAt(0.5)} stroke="var(--ink-faint)" strokeDasharray="1 3" />

      {/* Confidence band */}
      {showBand && <path d={bandPath} fill="var(--residual)" fillOpacity="0.12" />}

      {/* Line */}
      <path d={linePath} stroke="var(--residual)" strokeWidth="1.75" fill="none" />

      {/* Regime markers */}
      {showRegimes && regimes.map((r, i) => {
        const idx = data.findIndex(d => d.date === r.date);
        if (idx < 0) return null;
        const x = xAt(idx);
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={padT} y2={H - padB} stroke="var(--ink-faint)" strokeDasharray="2 3" />
            <g transform={`translate(${x}, ${padT + 6})`}>
              <rect x={-1} y={-1} width="2" height="6" fill="var(--ink-mid)" />
              <text x="6" y="4" fontSize="10" fontFamily="var(--f-mono)" fill="var(--ink-mid)" textTransform="uppercase" letterSpacing="0.08em">{r.label}</text>
            </g>
          </g>
        );
      })}

      {/* Data points on anchors */}
      {data.filter(d => ['2026-04-17','2026-04-18','2026-04-20'].includes(d.date)).map((d, i) => {
        const idx = data.indexOf(d);
        return (
          <g key={i}>
            <circle cx={xAt(idx)} cy={yAt(d.pct)} r="3" fill="var(--bg)" stroke="var(--residual)" strokeWidth="1.5" />
            <text x={xAt(idx) + 8} y={yAt(d.pct) - 6} fontSize="10" fontFamily="var(--f-mono)" fill="var(--residual)">{(d.pct*100).toFixed(1)}%</text>
          </g>
        );
      })}

      {/* X axis — sparse date labels */}
      {[0, Math.floor(n*0.25), Math.floor(n*0.5), Math.floor(n*0.75), n-1].map(i => (
        <text key={i} x={xAt(i)} y={H - padB + 16} fontSize="10" fontFamily="var(--f-mono)" fill="var(--ink-dim)" textAnchor="middle">{data[i].date.slice(5)}</text>
      ))}
    </svg>
  );
}

// Small multiple line for factor stability
function TinyLine({ data, label, height = 90, yMax = 0.3 }) {
  const W = 240, H = height;
  const padL = 32, padR = 8, padT = 16, padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = data.length;
  const xAt = i => padL + (i / (n - 1)) * innerW;
  const yAt = v => padT + (1 - v / yMax) * innerH;
  const d = data.map((v, i) => (i ? 'L' : 'M') + xAt(i).toFixed(1) + ' ' + yAt(v).toFixed(1)).join(' ');
  const mean = data.reduce((s, v) => s + v, 0) / data.length;

  return (
    <div className="panel" style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span className="eyebrow">{label}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink)' }}>{(mean*100).toFixed(1)}%<span style={{ color: 'var(--ink-dim)' }}> mean</span></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }}>
        {[0, yMax/2, yMax].map(g => (
          <line key={g} x1={padL} x2={W - padR} y1={yAt(g)} y2={yAt(g)} stroke="var(--line-lo)" strokeDasharray={g === 0 ? '0' : '2 4'} />
        ))}
        <text x={padL - 6} y={yAt(yMax) + 3} fontSize="9" fontFamily="var(--f-mono)" fill="var(--ink-dim)" textAnchor="end">{(yMax*100).toFixed(0)}%</text>
        <text x={padL - 6} y={yAt(0) + 3} fontSize="9" fontFamily="var(--f-mono)" fill="var(--ink-dim)" textAnchor="end">0</text>
        <path d={d} stroke="var(--ink-mid)" strokeWidth="1.25" fill="none" />
        <line x1={padL} x2={W - padR} y1={yAt(mean)} y2={yAt(mean)} stroke="var(--ink-faint)" strokeDasharray="1 3" />
      </svg>
    </div>
  );
}

// Dispersion fan — p10/p25/p50/p75/p90 over time
function DispersionFan({ data, height = 320 }) {
  const W = 1000, H = height;
  const padL = 52, padR = 20, padT = 20, padB = 42;
  const iW = W - padL - padR, iH = H - padT - padB;
  const n = data.length;
  const yMax = Math.max(...data.map(d => d.p90)) * 1.05;
  const yMin = Math.min(...data.map(d => d.p10)) * 0.95;

  const x = i => padL + (i / (n - 1)) * iW;
  const y = v => padT + (1 - (v - yMin) / (yMax - yMin)) * iH;

  const fanPath = (loKey, hiKey) => {
    const up = data.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d[hiKey]).toFixed(1));
    const dn = data.slice().reverse().map((d, i) => 'L' + x(n-1-i).toFixed(1) + ' ' + y(d[loKey]).toFixed(1));
    return [...up, ...dn, 'Z'].join(' ');
  };
  const medPath = data.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d.p50).toFixed(1)).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }}>
      {[0, 1, 2, 3, 4, 5, 6].map(g => (
        <g key={g}>
          <line x1={padL} x2={W-padR} y1={y(g)} y2={y(g)} stroke="var(--line-lo)" strokeDasharray={g === 0 ? '0' : '2 4'} />
          <text x={padL - 8} y={y(g) + 3} textAnchor="end" fontSize="10" fontFamily="var(--f-mono)" fill="var(--ink-dim)">${g}</text>
        </g>
      ))}
      <path d={fanPath('p10', 'p90')} fill="var(--ink-mid)" fillOpacity="0.08" />
      <path d={fanPath('p25', 'p75')} fill="var(--ink-mid)" fillOpacity="0.16" />
      <path d={medPath} stroke="var(--ink-hi)" strokeWidth="1.5" fill="none" />
      {[0, Math.floor(n*0.25), Math.floor(n*0.5), Math.floor(n*0.75), n-1].map(i => (
        <text key={i} x={x(i)} y={H - padB + 16} fontSize="10" fontFamily="var(--f-mono)" fill="var(--ink-dim)" textAnchor="middle">{data[i].date.slice(5)}</text>
      ))}
    </svg>
  );
}

Object.assign(window, { Sparkline, HeatCell, DecompBar, RollingLine, TinyLine, DispersionFan });
