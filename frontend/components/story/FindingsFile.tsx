"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Three documents spilled onto the blotter — a fax, an index card, a clipped
 * photograph sheet. The wrapper only throws; each child brings its own stock.
 *
 * The reader throws them: the entrance is scrubbed, so the sheets travel as far
 * as the scroll carries them, arrive on curved paths at different rates, and
 * settle at the angles they keep. Filing, performed (§13 law 1), not a timer
 * flourish.
 *
 * Resting CSS is the finished collage, so reduced motion and a JS failure both
 * leave three readable sheets. Phones get a short once-slide — no long scrub.
 */
export function FindingsFile({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const cards = () =>
        gsap.utils.toArray<HTMLElement>(".fc-card", root.current);

      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        const sheets = cards();
        if (sheets.length === 0) return;

        // Each document flies in from a different corner — asymmetric on
        // purpose so the spill reads as three pages, not a carousel.
        const throws = [
          { xPercent: -82, yPercent: 48, rotate: -22, scale: 0.93 },
          { xPercent: -20, yPercent: 96, rotate: 18, scale: 0.9 },
          { xPercent: 72, yPercent: 70, rotate: -14, scale: 0.94 },
        ];

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root.current,
            start: "top 86%",
            end: "top 34%",
            scrub: 0.7,
          },
        });

        sheets.forEach((sheet, index) => {
          const from = throws[index % throws.length];
          tl.from(
            sheet,
            {
              xPercent: from.xPercent,
              yPercent: from.yPercent,
              rotate: from.rotate,
              scale: from.scale,
              opacity: 0,
              // back.out lands each sheet slightly past its resting angle and
              // lets it drop in, which is what a thrown page does.
              ease: "back.out(1.35)",
              duration: 1,
            },
            index * 0.16
          );
          // The shadow blooms as the sheet lands rather than travelling with
          // it, so the paper reads as touching the desk only at the end.
          tl.fromTo(
            sheet,
            { "--fc-lift": 0 },
            { "--fc-lift": 1, ease: "power1.in", duration: 0.6 },
            index * 0.16 + 0.4
          );
        });

        return () => {
          tl.scrollTrigger?.kill();
          tl.kill();
        };
      });

      mm.add("(max-width: 767px) and (prefers-reduced-motion: no-preference)", () => {
        const sheets = cards();
        if (sheets.length === 0) return;

        const tweens = sheets.map((sheet, index) =>
          gsap.from(sheet, {
            y: 34,
            rotate: index % 2 === 0 ? -2.4 : 2.4,
            opacity: 0,
            duration: 0.62,
            ease: "power3.out",
            scrollTrigger: { trigger: sheet, start: "top 92%", once: true },
          })
        );

        return () => {
          tweens.forEach((t) => {
            t.scrollTrigger?.kill();
            t.kill();
          });
        };
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <div ref={root} className="fc-file" data-grow-scope>
      {children}
    </div>
  );
}
