"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * The method, run as a reel.
 *
 * Desktop: the section pins and the strip of frames is scrubbed sideways, so
 * scrolling literally advances footage. Phones do NOT get that — pinning a
 * 100vh stage fights the dynamic viewport and a scrubbed transform on a long
 * strip is the most expensive thing on the page. There the same strip becomes a
 * swipe with scroll snapping, which is native, momentum-correct and free.
 *
 * Either way all four frames are in the server HTML in reading order.
 */
export function Reel({
  head,
  children,
}: {
  /** Stays on screen for the whole pin: the strip moves, the title doesn't. */
  head: React.ReactNode;
  children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        const stage = root.current;
        const port = viewport.current;
        const strip = track.current;
        if (stage === null || port === null || strip === null) return;

        const distance = () => Math.max(0, strip.scrollWidth - port.clientWidth);

        const tween = gsap.to(strip, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: stage,
            start: "top top",
            end: () => `+=${distance() + window.innerHeight * 0.35}`,
            pin: true,
            anticipatePin: 1,
            scrub: 0.55,
            invalidateOnRefresh: true,
          },
        });

        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
          gsap.set(strip, { x: 0 });
        };
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <div ref={root} className="fc-reel">
      <div className="fc-reel__head">{head}</div>
      <div ref={viewport} className="fc-reel__viewport">
        <div
          ref={track}
          className="fc-reel__track"
          // On phones this is the scroll container itself. It is focusable and
          // labelled so the strip can be driven from a keyboard too.
          tabIndex={0}
          role="group"
          aria-label="The method, in four frames. Scroll or swipe sideways."
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function ReelFrame({
  index,
  label,
  children,
}: {
  /** Printed on the frame's leader, e.g. 01. */
  index: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <article className="fc-frame">
      <header className="fc-frame__leader">
        <span className="fc-frame__index">{index}</span>
        <span className="fc-frame__label">{label}</span>
        <span className="fc-frame__perf" aria-hidden />
      </header>
      <div className="fc-frame__body">{children}</div>
    </article>
  );
}
