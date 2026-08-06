import type { BulletinView } from "../sim/bulletinSim";

interface ExhibitBCustodyProps {
  view: BulletinView;
}

export function ExhibitBCustody({ view }: ExhibitBCustodyProps) {
  return (
    <figure className="bull-exhibit">
      <figcaption className="bull-exhibit__cap">
        <span>Exhibit B: Chain of custody, today&apos;s cycle</span>
        <span className="bull-exhibit__cap-meta">
          {view.skuCode} · <span className="bull-sim">[SIM]</span>
        </span>
      </figcaption>
      <ol className="bull-stages">
        {view.stages.map((s) => (
          <li key={s.num}>
            <div className="bull-stages__num">STAGE {s.num}</div>
            <div className="bull-stages__name">{s.name}</div>
            <div className="bull-stages__count">{s.count}</div>
            <div className="bull-stages__note">{s.note}</div>
          </li>
        ))}
      </ol>
    </figure>
  );
}
