/* global React */
// Basis — root app

function App() {
  return <BasisProvider><AppInner /></BasisProvider>;
}

function AppInner() {
  const { route } = useBasis();
  return (
    <>
      <TopBar />
      <main>
        {route === 'findings'     && <FindingsPage />}
        {route === 'basis'        && <BasisPage />}
        {route === 'slice'        && <SlicePage />}
        {route === 'rolling'      && <RollingPage />}
        {route === 'dispersion'   && <DispersionPage />}
        {route === 'providers'    && <ProvidersPage />}
        {route === 'methodology'  && <MethodologyPage />}
      </main>
      <Footer />
    </>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--line-lo)', marginTop: 80, padding: '32px 40px', maxWidth: 1480, margin: '80px auto 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span className="serif" style={{ fontSize: 14, color: 'var(--ink)' }}>Basis</span>
          <span className="caption mono">research artifact · public data · 2026</span>
        </div>
        <div className="caption mono">Not a price aggregator · Not a derivatives engine</div>
      </div>
    </footer>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
