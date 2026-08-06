"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * One entry per sheet. `dur` and `at` differ per sheet on purpose — identical
 * timing on every card is what makes a stagger read as a machine rather than
 * three pieces of paper with slightly different mass.
 *
 * `origin` puts the pivot near the corner that touches down first, so the
 * rotation reads as a sheet settling on a hinge instead of spinning about
 * its centre. `tilt` is the damped overshoot applied to the card itself.
 */
const THROW_FROM = [
  {
    xPercent: -58,
    yPercent: 34,
    rotate: -15,
    scale: 1.05,
    origin: "22% 86%",
    tilt: -1.9,
    dur: 0.82,
    at: 0,
  },
  {
    xPercent: -8,
    yPercent: 64,
    rotate: 12,
    scale: 1.07,
    origin: "50% 92%",
    tilt: 2.1,
    dur: 0.9,
    at: 0.1,
  },
  {
    xPercent: 48,
    yPercent: 44,
    rotate: -9,
    scale: 1.04,
    origin: "78% 84%",
    tilt: -1.6,
    dur: 0.86,
    at: 0.23,
  },
];

const SHEET_PROPS =
  "opacity,transform,transformOrigin,willChange,x,y,xPercent,yPercent,rotate,scale";

type SheetParts = {
  wrap: HTMLElement;
  card: HTMLElement | null;
  shadow: HTMLElement | null;
};

function partsOf(sheets: HTMLElement[]): SheetParts[] {
  return sheets.map((wrap) => ({
    wrap,
    card: wrap.querySelector<HTMLElement>(".fc-card"),
    shadow: wrap.querySelector<HTMLElement>(".fc-card-wrap__shadow"),
  }));
}

function clearSheetMotion(sheets: HTMLElement[], limitsEl: HTMLElement | null) {
  const layers = partsOf(sheets).flatMap(({ wrap, card, shadow }) =>
    [wrap, card, shadow].filter((el): el is HTMLElement => el !== null)
  );
  gsap.set(layers, { clearProps: SHEET_PROPS });
  if (limitsEl) gsap.set(limitsEl, { clearProps: "opacity,transform,y,willChange" });
}

/**
 * Three documents spilled onto the blotter — a fax, an index card, a clipped
 * photograph sheet. The wrapper only throws; each child brings its own stock.
 *
 * Resting CSS is the finished collage. Hover, focus, or tap brings any sheet
 * forward so overlapping papers stay readable after the throw lands.
 */
export function FindingsFile({
  children,
  limits,
}: {
  children: ReactNode;
  limits?: ReactNode;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const limitsRef = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [landed, setLanded] = useState(false);
  const active = pinned ?? hovered;

  const activate = useCallback((index: number) => {
    setPinned((current) => (current === index ? null : index));
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const wraps = () =>
        gsap.utils.toArray<HTMLElement>(".fc-card-wrap", root.current);

      const finish = (sheets: HTMLElement[]) => {
        clearSheetMotion(sheets, limitsRef.current);
        setLanded(true);
      };

      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        const sheets = wraps();
        if (sheets.length === 0) return;

        const limitsEl = limitsRef.current;
        const parts = partsOf(sheets);

        // Nothing shows before the throw fires, so a fast scroll can't catch
        // the sheets at rest and then re-throw them.
        gsap.set(sheets, { opacity: 0 });

        const tl = gsap.timeline({
          paused: true,
          defaults: { immediateRender: false, force3D: true },
          onComplete: () => finish(sheets),
        });

        parts.forEach(({ wrap, card, shadow }, index) => {
          const from = THROW_FROM[index % THROW_FROM.length];
          const { at, dur } = from;

          const layers = [wrap, card, shadow].filter(
            (el): el is HTMLElement => el !== null
          );
          gsap.set(wrap, { transformOrigin: from.origin });
          // Promote for the throw only; clearSheetMotion drops it again so we
          // are not holding three compositor layers for the rest of the page.
          gsap.set(layers, { willChange: "transform" });

          // Paper is opaque. Resolve it fast and let motion carry the rest —
          // a 0.7s fade is what made the sheets read as ghosting UI.
          tl.fromTo(
            wrap,
            { opacity: 0 },
            { opacity: 1, duration: 0.26, ease: "power1.out" },
            at
          );

          // x and y are separate tweens with different curves and lengths.
          // Equal easing on both axes gives a straight line; a slower, deeper
          // vertical settle bends the path into an arc.
          tl.from(wrap, { xPercent: from.xPercent, duration: dur, ease: "power2.out" }, at);
          tl.from(
            wrap,
            { yPercent: from.yPercent, duration: dur * 1.16, ease: "power3.out" },
            at
          );
          tl.from(wrap, { rotate: from.rotate, duration: dur * 0.92, ease: "power2.out" }, at);
          // Larger → rest reads as dropping toward the desk, not flying in
          // from the distance.
          tl.from(wrap, { scale: from.scale, duration: dur, ease: "power2.out" }, at);

          // Depth cue: the cast shadow is wide and absent while the sheet is
          // off the surface, and tightens as it touches down.
          if (shadow) {
            tl.fromTo(
              shadow,
              { opacity: 0, scale: 1.22, yPercent: -10 },
              {
                opacity: 1,
                scale: 1,
                yPercent: 0,
                duration: dur * 1.08,
                ease: "power3.out",
              },
              at
            );
          }

          // The settle. Travel stops; the sheet keeps a little angular energy
          // and damps it out. This is the whole difference between "lands"
          // and "snaps into place".
          if (card) {
            tl.from(
              card,
              { rotate: from.tilt, duration: 0.9, ease: "elastic.out(1, 0.62)" },
              at + dur * 0.58
            );
          }
        });

        if (limitsEl) {
          tl.from(
            limitsEl,
            { opacity: 0, y: 16, duration: 0.55, ease: "power3.out" },
            0.52
          );
        }

        const st = ScrollTrigger.create({
          trigger: root.current,
          start: "top 88%",
          once: true,
          animation: tl,
        });

        ScrollTrigger.refresh();
        if (st.progress > 0) {
          tl.progress(1);
          finish(sheets);
        }

        return () => {
          st.kill();
          tl.kill();
          clearSheetMotion(sheets, limitsEl);
          setLanded(false);
        };
      });

      mm.add("(max-width: 767px) and (prefers-reduced-motion: no-preference)", () => {
        const sheets = wraps();
        if (sheets.length === 0) return;

        const limitsEl = limitsRef.current;
        const parts = partsOf(sheets);
        let settled = 0;

        gsap.set(sheets, { opacity: 0 });

        // The mobile layout pins the wrapper with `transform: none !important`,
        // which an inline GSAP transform cannot beat — so travel goes on the
        // card and only opacity goes on the wrapper.
        const timelines = parts.map(({ wrap, card, shadow }, index) => {
          const layers = [wrap, card, shadow].filter(
            (el): el is HTMLElement => el !== null
          );
          gsap.set(layers, { willChange: "transform" });

          const tl = gsap.timeline({
            defaults: { immediateRender: false, force3D: true },
            scrollTrigger: { trigger: wrap, start: "top 94%", once: true },
            onComplete: () => {
              settled += 1;
              if (settled === parts.length) finish(sheets);
            },
          });

          tl.fromTo(wrap, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: "power1.out" }, 0);
          if (card) {
            tl.from(card, { y: 26 + index * 4, duration: 0.62, ease: "power3.out" }, 0);
            tl.from(
              card,
              {
                rotate: index % 2 === 0 ? -1.5 : 1.5,
                duration: 0.7,
                ease: "elastic.out(1, 0.68)",
              },
              0.24
            );
          }
          if (shadow) {
            tl.fromTo(
              shadow,
              { opacity: 0, scale: 1.14 },
              { opacity: 1, scale: 1, duration: 0.6, ease: "power3.out" },
              0
            );
          }
          return tl;
        });

        const limitsTween = limitsEl
          ? gsap.from(limitsEl, {
              opacity: 0,
              y: 12,
              duration: 0.5,
              ease: "power3.out",
              immediateRender: false,
              scrollTrigger: { trigger: limitsEl, start: "top 94%", once: true },
            })
          : null;

        return () => {
          timelines.forEach((tl) => {
            tl.scrollTrigger?.kill();
            tl.kill();
          });
          limitsTween?.scrollTrigger?.kill();
          limitsTween?.kill();
          clearSheetMotion(sheets, limitsEl);
          setLanded(false);
        };
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        const sheets = wraps();
        finish(sheets);
        return () => setLanded(false);
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  useEffect(() => {
    const rootEl = root.current;
    if (rootEl === null) return;

    const onToggle = (event: Event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement) || !details.open) return;

      const wrap = details.closest<HTMLElement>(".fc-card-wrap");
      if (wrap === null) return;

      const index = Number(wrap.dataset.sheet) - 1;
      if (Number.isFinite(index) && index >= 0) {
        setPinned(index);
      }
    };

    rootEl.addEventListener("toggle", onToggle, true);
    return () => rootEl.removeEventListener("toggle", onToggle, true);
  }, []);

  const wrapped = Children.map(children, (child, index) => {
    if (!isValidElement(child)) return child;

    const sheet = child as ReactElement<{
      className?: string;
      tabIndex?: number;
      onFocus?: () => void;
      onBlur?: () => void;
      onKeyDown?: (event: React.KeyboardEvent) => void;
      "aria-pressed"?: boolean;
    }>;

    const isActive = active === index;

    return (
      <div
        key={index}
        className={[
          "fc-card-wrap",
          isActive ? "is-front" : "",
          active !== null && !isActive ? "is-back" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-sheet={index + 1}
        onMouseEnter={() => setHovered(index)}
        onMouseLeave={() => setHovered(null)}
        onClick={(event) => {
          if (
            (event.target as HTMLElement).closest(
              "a, button, summary, details, .two-layer__toggle"
            )
          ) {
            return;
          }
          activate(index);
        }}
      >
        <span className="fc-card-wrap__shadow" aria-hidden />
        {cloneElement(sheet, {
          tabIndex: 0,
          className: [sheet.props.className, isActive ? "is-front" : ""]
            .filter(Boolean)
            .join(" "),
          "aria-pressed": pinned === index,
          onFocus: () => setHovered(index),
          onBlur: () => setHovered(null),
          onKeyDown: (event: React.KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              activate(index);
            }
          },
        })}
      </div>
    );
  });

  return (
    <>
      <div
        ref={root}
        className={[
          "fc-file",
          landed ? "is-landed" : "",
          active !== null ? "has-front" : "",
          landed ? "is-settled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-grow-scope
        role="group"
        aria-label="Three finding sheets. Select any sheet to bring it forward for reading."
      >
        {wrapped}
        <p className="fc-file__hint" aria-hidden>
          Select a sheet to read it in full
        </p>
      </div>
      {limits ? (
        <div ref={limitsRef} className="fc-limits-wrap">
          {limits}
        </div>
      ) : null}
    </>
  );
}
