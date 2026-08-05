"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * The landing's scroll motion, in one place so it can be audited against the
 * GSAP whitelist (design doc §12: core + ScrollTrigger + useGSAP, landing
 * only) and against the three motion laws (§13).
 *
 * Every tween here is a `from()`: the resting state in CSS is the finished
 * composition, so the server HTML, a JS failure, and prefers-reduced-motion
 * all render the complete page. Nothing loops, nothing autoplays, and the only
 * numbers that tween are the ones the API served.
 *
 * Phones are a separate direction rather than a scaled copy: shallower
 * parallax, one group fade instead of hundreds of per-dot tweens, and no
 * pinning (the reel becomes a swipe, handled in Reel).
 */
export function StoryMotion() {
  const scope = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Plates drift against the scroll. The frame carries slack equal to
      // `--fc-depth` on each edge, so the travel is expressed as a share of
      // the oversized image rather than a pixel guess.
      const parallax = (scale: number) => {
        gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
          const depth =
            parseFloat(getComputedStyle(el).getPropertyValue("--fc-depth")) || 0;
          if (depth <= 0) return;
          const travel = (100 * depth * scale) / (1 + 2 * depth);
          gsap.fromTo(
            el,
            { yPercent: -travel },
            {
              yPercent: travel,
              ease: "none",
              scrollTrigger: {
                trigger: el.parentElement ?? el,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            }
          );
        });
      };

      // Statement lines rise out of their own overflow, one after another.
      // The cold open runs its own mount sequence instead.
      const lines = () => {
        gsap.utils.toArray<HTMLElement>("[data-lines]").forEach((group) => {
          if (group.closest(".fc-act--open")) return;
          const inner = group.querySelectorAll<HTMLElement>("[data-line] > *");
          if (inner.length === 0) return;
          gsap.from(inner, {
            yPercent: 110,
            duration: 0.95,
            ease: "power3.out",
            stagger: 0.075,
            scrollTrigger: { trigger: group, start: "top 88%", once: true },
          });
        });
      };

      // Entries get stamped into the ledger: no drift, no slide, just arrival.
      const stamps = () => {
        gsap.utils.toArray<HTMLElement>("[data-stamp]").forEach((el) => {
          if (el.closest(".fc-act--open")) return;
          const children = el.hasAttribute("data-stamp-group")
            ? Array.from(el.children)
            : [el];
          gsap.from(children, {
            opacity: 0,
            y: 12,
            duration: 0.6,
            ease: "power2.out",
            stagger: children.length > 1 ? 0.07 : 0,
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
          });
        });
      };

      // Cold open: photograph resolves, headline staggers, prices arrive.
      const coldOpen = () => {
        const act = document.querySelector<HTMLElement>(".fc-act--open");
        if (!act) return;

        const plate = act.querySelector<HTMLElement>(".fc-plate__img");
        const head = act.querySelector<HTMLElement>(".fc-open__head");
        const headline = act.querySelectorAll<HTMLElement>(
          ".fc-open__head-line [data-line] > *"
        );
        const pairSides = act.querySelectorAll<HTMLElement>(".fc-pair__side");
        const multiple = act.querySelector<HTMLElement>(".fc-pair__multiple");
        const bracket = act.querySelector<HTMLElement>(".fc-pair__bracket");
        const foot = act.querySelector<HTMLElement>(".fc-open__foot");

        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

        if (plate) {
          tl.from(plate, { opacity: 0, scale: 1.03, duration: 0.9 }, 0);
        }
        if (head) {
          tl.from(head, { opacity: 0, y: 8, duration: 0.45 }, 0.08);
        }
        if (headline.length > 0) {
          tl.from(
            headline,
            { yPercent: 110, duration: 0.8, stagger: 0.08 },
            0.12
          );
        }
        if (pairSides.length > 0) {
          tl.from(pairSides, { opacity: 0, y: 14, duration: 0.5, stagger: 0.1 }, 0.42);
        }
        if (multiple) {
          tl.from(multiple, { opacity: 0, scale: 0.88, duration: 0.35 }, 0.58);
        }
        if (bracket) {
          tl.from(bracket, { opacity: 0, duration: 0.4 }, 0.62);
        }
        if (foot) {
          tl.from(foot.children, { opacity: 0, y: 10, duration: 0.45, stagger: 0.08 }, 0.72);
        }
      };

      // Bars are measurements, so they draw with the scroll rather than on a
      // timer: the reader controls how fast the quantity fills.
      const bars = () => {
        gsap.utils.toArray<HTMLElement>("[data-grow]").forEach((el) => {
          gsap.from(el, {
            scaleX: 0,
            transformOrigin: "left center",
            ease: "none",
            scrollTrigger: {
              trigger: el.closest("[data-grow-scope]") ?? el,
              start: "top 82%",
              end: "top 42%",
              scrub: true,
            },
          });
        });
      };

      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        coldOpen();
        parallax(1);
        lines();
        stamps();
        bars();

        // Every quote settles individually on a wide screen, ordered from the
        // cheapest to the dearest so the eye reads the axis as it fills.
        gsap.utils.toArray<HTMLElement>("[data-dots]").forEach((lane) => {
          const dots = lane.querySelectorAll<HTMLElement>(".fc-dot");
          if (dots.length === 0) return;
          gsap.from(dots, {
            opacity: 0,
            scale: 0.3,
            duration: 0.5,
            ease: "power2.out",
            stagger: { each: Math.min(0.012, 1.2 / dots.length), from: "start" },
            scrollTrigger: { trigger: lane, start: "top 88%", once: true },
          });
        });
      });

      mm.add("(max-width: 767px) and (prefers-reduced-motion: no-preference)", () => {
        coldOpen();
        // Half the travel: a phone viewport is short, so the same depth reads
        // as a lurch. Dots fade as one layer — 300+ tweens is a dropped frame.
        parallax(0.5);
        lines();
        stamps();
        bars();

        gsap.utils.toArray<HTMLElement>("[data-dots]").forEach((lane) => {
          gsap.from(lane, {
            opacity: 0,
            duration: 0.5,
            ease: "power1.out",
            scrollTrigger: { trigger: lane, start: "top 92%", once: true },
          });
        });
      });

      // Late layout shifts (webfont swap, a plate decoding) move every trigger
      // boundary, so the triggers are recomputed once both have settled.
      const refresh = () => ScrollTrigger.refresh();
      if (document.fonts) {
        if (document.fonts.status === "loaded") refresh();
        else void document.fonts.ready.then(refresh);
      }

      const plates = Array.from(
        document.querySelectorAll<HTMLImageElement>(".fc-plate__img")
      ).filter((img) => !img.complete);
      plates.forEach((img) =>
        img.addEventListener("load", refresh, { once: true })
      );

      return () => {
        plates.forEach((img) => img.removeEventListener("load", refresh));
        // matchMedia contexts are not owned by useGSAP's context, so they are
        // reverted by hand or they survive a route change.
        mm.revert();
      };
    },
    { scope }
  );

  return <div ref={scope} className="fc-motion-scope" aria-hidden />;
}
