"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const NOTES: { title: string; body: string }[] = [
  {
    title: "Conservative normalization",
    body: "When a field can't be reliably mapped it stays UNKNOWN. The residual is what remains after only confident inferences; permissive mapping would launder noise into region or bundle and understate the finding.",
  },
  {
    title: "Quoted, not transacted",
    body: "Enterprise transaction prices likely compress dispersion. Gated benchmarks like Ornn's OCPI measure the other side of this gap.",
  },
  {
    title: "Short sample",
    body: "The cron continues to collect; residuals will move as data accumulates and the range will narrow over the next few weeks.",
  },
];

/**
 * The limitations, filed as notes appended to the record. Copy is unchanged
 * from the caveat cards it replaces — presentation only.
 */
export function FileNotes() {
  const root = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const batches = ScrollTrigger.batch("[data-note]", {
          start: "top 92%",
          once: true,
          onEnter: (targets) =>
            gsap.from(targets, {
              opacity: 0,
              y: 10,
              duration: 0.4,
              stagger: 0.08,
              ease: "power2.out",
              overwrite: true,
            }),
        });
        return () => batches.forEach((b) => b.kill());
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <section className="dossier" ref={root}>
      <div className="dossier-band">APPENDIX · FILE NOTES ON LIMITATIONS</div>
      <div className="notes">
        {NOTES.map((note, i) => (
          <article className="note" data-note key={note.title}>
            <div className="note__n">{String(i + 1).padStart(2, "0")}</div>
            <div>
              <h3 className="note__title">{note.title}</h3>
              <p className="note__body">{note.body}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="dossier-band dossier-band--foot">END OF FILE</div>
    </section>
  );
}
