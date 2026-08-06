"use client";

import Link from "next/link";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const STAMPS = [
  { index: "01", label: "Collect", detail: "08:00 / 20:00 UTC" },
  { index: "02", label: "File", detail: "raw, immutable" },
  { index: "03", label: "Canonicalize", detail: "rule-based only" },
  { index: "04", label: "Account", detail: "variance decomposition" },
] as const;

/**
 * A four-stamp chain of custody — enough to show the method exists and is
 * ordered, without teaching it on the landing page. Scroll plays the stamps
 * once; the CTA hands off to /methodology.
 */
export function MethodPassport() {
  const root = useRef<HTMLDivElement | null>(null);
  const spineRef = useRef<SVGPathElement | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const stampRefs = useRef<(HTMLDivElement | null)[]>([]);

  useGSAP(
    () => {
      const rootEl = root.current;
      const spine = spineRef.current;
      const cta = ctaRef.current;
      const stamps = stampRefs.current.filter(
        (el): el is HTMLDivElement => el !== null
      );
      if (rootEl === null || stamps.length === 0) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      const spineLength = spine?.getTotalLength() ?? 0;
      if (spine && spineLength > 0) {
        gsap.set(spine, {
          strokeDasharray: spineLength,
          strokeDashoffset: spineLength,
        });
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootEl,
          start: "top 78%",
          once: true,
        },
        defaults: { ease: "power2.out" },
      });

      if (spine && spineLength > 0) {
        tl.from(
          spine,
          { strokeDashoffset: spineLength, duration: 0.65, ease: "power2.inOut" },
          0
        );
      }

      tl.from(
        stamps,
        {
          opacity: 0,
          y: 18,
          scale: 0.96,
          duration: 0.42,
          stagger: 0.11,
          ease: "back.out(1.35)",
        },
        0.08
      );

      if (cta) {
        tl.from(cta, { opacity: 0, y: 12, duration: 0.38 }, "-=0.12");
      }

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
      };
    },
    { scope: root }
  );

  return (
    <div ref={root} className="fc-passport">
      <div className="fc-passport__spine" aria-hidden>
        <svg
          className="fc-passport__spine-svg"
          viewBox="0 0 1000 8"
          preserveAspectRatio="none"
        >
          <path
            ref={spineRef}
            className="fc-passport__spine-path"
            d="M0 4 H1000"
          />
        </svg>
      </div>

      <ol
        className="fc-passport__stamps"
        aria-label="Method pipeline: collect, file, canonicalize, account"
      >
        {STAMPS.map((stamp, index) => (
          <li key={stamp.index} className="fc-passport__stamp">
            <div
              ref={(el) => {
                stampRefs.current[index] = el;
              }}
              className="fc-passport__stamp-inner"
            >
              <span className="fc-passport__stamp-index">{stamp.index}</span>
              <span className="fc-passport__stamp-label serif">{stamp.label}</span>
              <span className="fc-passport__stamp-detail">{stamp.detail}</span>
            </div>
          </li>
        ))}
      </ol>

      <div ref={ctaRef} className="fc-passport__cta">
        <Link href="/methodology" className="fc-btn">
          Open the methodology →
        </Link>
        <Link href="/methodology#collection" className="fc-passport__secondary">
          Or jump to the pipeline diagram
        </Link>
      </div>
    </div>
  );
}
