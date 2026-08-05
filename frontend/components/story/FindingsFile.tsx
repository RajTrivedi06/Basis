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

const SHEET_COUNT = 3;

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
  const [settled, setSettled] = useState(false);
  const active = pinned ?? hovered;

  const activate = useCallback((index: number) => {
    setPinned((current) => (current === index ? null : index));
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const wraps = () =>
        gsap.utils.toArray<HTMLElement>(".fc-card-wrap", root.current);

      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        const sheets = wraps();
        if (sheets.length === 0) return;

        // Deterministic throw paths — fax, index card, attachment, in order.
        const throws = [
          { xPercent: -62, yPercent: 38, rotate: -16, scale: 0.94 },
          { xPercent: -10, yPercent: 72, rotate: 12, scale: 0.91 },
          { xPercent: 52, yPercent: 50, rotate: -10, scale: 0.93 },
        ];

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root.current,
            start: "top 92%",
            end: "top 24%",
            scrub: 0.65,
            onUpdate: (self) => {
              setSettled(self.progress >= 0.98);
            },
          },
        });

        sheets.forEach((sheet, index) => {
          const from = throws[index % throws.length];
          const at = index * 0.14;
          tl.from(
            sheet,
            {
              xPercent: from.xPercent,
              yPercent: from.yPercent,
              rotate: from.rotate,
              scale: from.scale,
              opacity: 0,
              ease: "back.out(1.15)",
              duration: 1,
            },
            at
          );
          tl.fromTo(
            sheet,
            { "--fc-lift": 0 },
            { "--fc-lift": 1, ease: "power1.in", duration: 0.45 },
            at + 0.38
          );
        });

        const limitsEl = limitsRef.current;
        if (limitsEl) {
          tl.from(
            limitsEl,
            { opacity: 0, y: 16, duration: 0.55, ease: "power2.out" },
            0.52
          );
        }

        return () => {
          tl.scrollTrigger?.kill();
          tl.kill();
          setSettled(false);
        };
      });

      mm.add("(max-width: 767px) and (prefers-reduced-motion: no-preference)", () => {
        const sheets = wraps();
        if (sheets.length === 0) return;

        const tweens = sheets.map((sheet, index) =>
          gsap.from(sheet, {
            y: 28,
            rotate: index % 2 === 0 ? -1.4 : 1.4,
            opacity: 0,
            duration: 0.55,
            ease: "power3.out",
            scrollTrigger: { trigger: sheet, start: "top 94%", once: true },
            onComplete: () => setSettled(true),
          })
        );

        const limitsEl = limitsRef.current;
        if (limitsEl) {
          gsap.from(limitsEl, {
            opacity: 0,
            y: 12,
            duration: 0.5,
            ease: "power2.out",
            scrollTrigger: { trigger: limitsEl, start: "top 94%", once: true },
          });
        }

        return () => {
          tweens.forEach((t) => {
            t.scrollTrigger?.kill();
            t.kill();
          });
          setSettled(false);
        };
      });

      return () => mm.revert();
    },
    { scope: root, dependencies: [limits] }
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
          active !== null ? "has-front" : "",
          settled ? "is-settled" : "",
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
