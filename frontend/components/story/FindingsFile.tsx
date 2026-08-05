"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Three sheets thrown onto the desk.
 *
 * The reader throws them: the whole entrance is scrubbed, so the sheets travel
 * exactly as far as the scroll carries them, arrive on curved paths at
 * different rates, and settle at the angles they keep. That is the act of
 * filing, performed (§13 law 1), rather than a decorative flourish on a timer.
 *
 * The children are server-rendered cards. This wrapper never owns copy — it
 * animates whatever it is handed, and its resting CSS is the finished collage,
 * so reduced motion and a JS failure both leave three readable sheets.
 *
 * Phones get a different throw: a short slide with a settle, once, no scrub and
 * no long travel, because a 300px-wide sheet crossing the viewport twice while
 * a thumb scrolls is the jankiest thing this page could do.
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

        // Each sheet comes from its own corner. Values are deliberately
        // asymmetric: three identical arcs read as a carousel, not a throw.
        const throws = [
          { xPercent: -78, yPercent: 58, rotate: -17, scale: 0.94 },
          { xPercent: -34, yPercent: 92, rotate: 15, scale: 0.92 },
          { xPercent: 66, yPercent: 74, rotate: -11, scale: 0.95 },
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
