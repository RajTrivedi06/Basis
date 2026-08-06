"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { LedgerWaterfall } from "@/components/charts/LedgerWaterfall";
import { buildLedger } from "@/lib/ledger";
import type { BasisDecompositionResponse } from "@/lib/types";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** First entry present from the outset, so the sheet is never a blank form. */
const PROGRESS_FLOOR = 0.06;

/**
 * Exhibit C — the settlement sheet, as the reference draws it: ONE sheet of
 * ruled paper you see whole.
 *
 * It is deliberately not pinned. A pinned 100svh frame cannot hold a heading,
 * a slate, five filed rows and a footer at laptop heights, so it ends up either
 * clipping the sheet or turning it into a nested scroll region — and then the
 * reader never sees the exhibit all at once, which is the whole point of an
 * exhibit. Instead the section scrolls normally, and arriving at it files the
 * sheet: rows are credited one at a time and the remainder lands last, then it
 * settles as a finished sheet and stays that way.
 *
 * `progress === undefined` means "finished" — what the server renders, what a
 * JS-less client keeps, what reduced motion gets, and what the filing hands
 * back to on completion. The animation only ever adds the filing; it never
 * gates the content.
 *
 * There is no population toggle here by ruling (design doc Decision #3, "never
 * on the landing"). The population is stated in the head instead.
 */
export function SettlementSheet({
  decomposition,
  head,
  foot,
}: {
  decomposition: BasisDecompositionResponse;
  /** Eyebrow, statement and the population, aligned to the sheet's left edge. */
  head: ReactNode;
  /** Verdict and standing note, printed on the sheet rather than after it. */
  foot: ReactNode;
}) {
  const scene = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState<number | undefined>(undefined);

  const steps = useMemo(() => {
    const ledger = buildLedger(
      decomposition as unknown as Record<string, unknown>
    );
    return ledger.rows.length + 1;
  }, [decomposition]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const card = scene.current;
        if (card === null) return;

        // Scroll-ENTERED, not scroll-scrubbed. A scrub ties how much of the
        // sheet is filled to where the reader happens to have stopped, so the
        // exhibit sits half-credited with reserved blank space below it — which
        // reads as a broken component, not as a ledger mid-subtraction. Entering
        // the sheet starts the filing; it always finishes, and then the sheet
        // hands itself back to its finished state.
        const state = { p: PROGRESS_FLOOR };
        setProgress(PROGRESS_FLOOR);

        const fill = gsap.to(state, {
          p: 1,
          duration: 0.22 * steps + 0.35,
          ease: "power1.inOut",
          paused: true,
          onUpdate: () => setProgress(state.p),
          onComplete: () => setProgress(undefined),
        });

        const st = ScrollTrigger.create({
          trigger: card,
          start: "top 80%",
          once: true,
          onEnter: () => fill.play(),
        });

        return () => {
          st.kill();
          fill.kill();
          setProgress(undefined);
        };
      });

      return () => mm.revert();
    },
    { scope: scene, dependencies: [steps] }
  );

  return (
    <div className="fc-wrap">
      <div className="fc-sheet__head">{head}</div>

      <div ref={scene} className="fc-sheet__card">
        {/* One line. The population is stated once, on the head, and the
            ledger's own glyph caption already carries the Live tag; both
            used to be repeated here. */}
        <div className="fc-sheet__slate">
          <span>
            <span translate="no">{decomposition.gpu_sku}</span> ·{" "}
            {decomposition.date} · sequential ANOVA on log price
          </span>
        </div>

        {/* No stamp attributes: the scrub writes opacity and width through
            React, and a GSAP from() on the same nodes would fight it. */}
        <div className="fc-sheet__ledger">
          <LedgerWaterfall
            decomposition={decomposition}
            progress={progress}
            showGlanceGlyph
            glanceLabel={decomposition.gpu_sku}
          />
        </div>

        <div className="fc-sheet__foot">{foot}</div>
      </div>
    </div>
  );
}
