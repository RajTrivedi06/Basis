"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { footageLabel } from "@/lib/fileCopy";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * The reader's position in the file, printed like a projector readout: how far
 * the reel has run, and under what authority the copy was released.
 *
 * This is an indicator rather than decoration, so it updates under
 * prefers-reduced-motion too — it just never eases or animates on its own.
 * It sits at the foot of the viewport instead of the head because the site
 * header already owns the top edge, and two bars of chrome is one too many.
 */
export function FilmRibbon() {
  const root = useRef<HTMLDivElement | null>(null);
  const rule = useRef<HTMLSpanElement | null>(null);
  const feet = useRef<HTMLSpanElement | null>(null);

  useGSAP(
    () => {
      const bar = rule.current;
      const readout = feet.current;
      if (bar === null || readout === null) return;

      // Progress is measured against the live max scroll rather than a
      // trigger's own start/end. Two sections pin, which changes the
      // document's height after this runs; a fixed end would have the reel
      // reading 1187 feet with a third of the file still to come.
      const paint = () => {
        const max = ScrollTrigger.maxScroll(window);
        const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
        gsap.set(bar, { scaleX: progress });
        const label = footageLabel(progress);
        if (readout.textContent !== label) readout.textContent = label;
      };

      const trigger = ScrollTrigger.create({
        trigger: document.documentElement,
        start: "top top",
        end: "bottom bottom",
        onUpdate: paint,
        onRefresh: paint,
      });
      paint();

      return () => trigger.kill();
    },
    { scope: root }
  );

  return (
    <div ref={root} className="fc-ribbon" role="presentation">
      <span className="fc-ribbon__rule" aria-hidden>
        <span ref={rule} className="fc-ribbon__rule-fill" />
      </span>
      <span className="fc-ribbon__authority">
        <span className="fc-ribbon__dot" aria-hidden />
        Declassified in full
        <span className="fc-ribbon__sep" aria-hidden />
        <span className="fc-ribbon__authority-tail">
          authority: public data
        </span>
      </span>
      <span className="fc-ribbon__meta">
        <span className="fc-ribbon__footage">
          Footage <span ref={feet}>0000</span> ft
        </span>
        <span className="fc-ribbon__copy">Copy 01 of 01</span>
      </span>
    </div>
  );
}
