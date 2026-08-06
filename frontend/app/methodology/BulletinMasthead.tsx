import { BulletinStamp } from "./BulletinStamp";

export function BulletinMasthead() {
  return (
    <>
      <div className="bull-classbar">
        <span className="bull-classbar__struck">TOP SECRET // EYES ONLY</span>
        <span className="bull-classbar__declass">
          <span className="bull-classbar__star">★</span> DECLASSIFIED: PUBLIC
          RELEASE <span className="bull-classbar__star">★</span>
        </span>
      </div>

      <header className="bull-mast">
        <div className="bull-mast__titleblock">
          <div className="bull-mast__name">The Internal Bulletin</div>
          <div className="bull-mast__sub">
            Published for field personnel of the Directorate of Measurement
          </div>
        </div>

        <div className="bull-mast__meta">
          <span>VOL. XXIV, NO. 3</span>
          <span>TUESDAY, OCTOBER 12, 1965</span>
          <span>LANGLEY, VA.</span>
          <span>5¢ · INTERNAL DISTRIBUTION ONLY</span>
        </div>

        <div className="bull-mast__proof">
          DESIGN PROOF: FIGURES MARKED <span className="bull-sim">[SIM]</span>{" "}
          ARE SIMULATED; PRODUCTION VALUES ARRIVE FROM THE LIVE WIRE{" "}
          <span className="bull-sim">[LIVE]</span>
        </div>

        <div className="bull-mast__desk">
          <div className="bull-extra">Extra</div>
          <div className="bull-desk-label">
            Methodology desk: declassification special
          </div>
          <div style={{ marginLeft: "auto" }}>
            <BulletinStamp>
              Approved
              <br />
              for release
            </BulletinStamp>
          </div>
        </div>

        <h1 className="bull-mast__headline">
          Directorate subtracts every known cause; what remains is filed as the
          finding
        </h1>
      </header>
    </>
  );
}
