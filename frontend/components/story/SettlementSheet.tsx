"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { LedgerWaterfall } from "@/components/charts/LedgerWaterfall";
import type { BasisDecompositionResponse } from "@/lib/types";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * The settlement sheet: the approved ledger waterfall (variant 1e) with the
 * scroll doing the subtracting. One row is filed per turn of the scroll, and
 * the remainder lands last.
 *
 * `progress === undefined` means "finished", which is what the server renders,
 * what a JS-less client keeps, and what reduced motion and phones get. The
 * scrub only takes over when the sheet is still below the fold at mount, so a
 * deep link into the middle of the page never sees a filled sheet empty itself.
 *
 * There is no population toggle here by ruling (design doc Decision #3, "never
 * on the landing"). The population is stated instead, in the slate.
 */
export function SettlementSheet({
  decomposition,
  population,
}: {
  decomposition: BasisDecompositionResponse;
  population: string;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState<number | undefined>(undefined);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        const section = root.current;
        const pinned = stage.current;
        if (section === null || pinned === null) return;

        // Already on screen: leave the finished sheet alone.
        if (section.getBoundingClientRect().top < window.innerHeight * 0.85) {
          return;
        }

        // A floor of 0.06 keeps the first entry on the sheet from the
        // moment it pins: an empty ruled card, however briefly, reads as a
        // component that failed rather than a ledger about to be written.
        const floor = (value: number) => Math.max(0.06, value);

        setProgress(floor(0));
        const trigger = ScrollTrigger.create({
          trigger: section,
          start: "top 8%",
          end: "+=150%",
          pin: pinned,
          anticipatePin: 1,
          onUpdate: (self) => setProgress(floor(self.progress)),
          onRefreshInit: () => setProgress(floor(0)),
        });

        return () => {
          trigger.kill();
          setProgress(undefined);
        };
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <div ref={root} className="fc-sheet">
      <div ref={stage} className="fc-sheet__stage">
        <div className="fc-sheet__slate">
          <span>
            <span translate="no">{decomposition.gpu_sku}</span> ·{" "}
            {decomposition.date} · sequential ANOVA on log price
          </span>
          <span className="fc-sheet__pop">{population}</span>
        </div>
        {/* No stamp attributes here on purpose: the desktop scrub writes
            opacity and width inline through React, and a GSAP from() on the
            same nodes would fight it. Phones get the finished sheet, which is
            the right call anyway — a ledger reads as a ledger standing still. */}
        <div className="fc-sheet__ledger">
          <LedgerWaterfall
            decomposition={decomposition}
            progress={progress}
            showGlanceGlyph
            glanceLabel={decomposition.gpu_sku}
          />
        </div>
      </div>
    </div>
  );
}
