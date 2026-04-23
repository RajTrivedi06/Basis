import { FindingsHero } from "@/components/FindingsHero";
import { FungibilityMatrix } from "@/components/FungibilityMatrix";

export default function FindingsPage() {
  return (
    <div className="space-y-12">
      <FindingsHero />

      <FungibilityMatrix />

      <section
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Caveat
          title="Conservative normalization"
          body="When a field can't be reliably mapped it stays UNKNOWN. The residual is what remains after only confident inferences; permissive mapping would launder noise into region or bundle and understate the finding."
        />
        <Caveat
          title="Quoted, not transacted"
          body="Enterprise transaction prices likely compress dispersion. Gated benchmarks like Ornn's OCPI measure the other side of this gap."
        />
        <Caveat
          title="Short sample"
          body="The cron has been running since 2026-04-17 and continues to collect. Residuals will move as data accumulates; expect the range to narrow over the next few weeks."
        />
      </section>
    </div>
  );
}

function Caveat({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel" style={{ padding: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--ink-mid)",
          lineHeight: 1.55,
        }}
      >
        {body}
      </div>
    </div>
  );
}
