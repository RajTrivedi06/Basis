"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface TocItem {
  id: string;
  num: string;
  title: string;
}

interface MethodologyChromeProps {
  items: TocItem[];
}

/**
 * Fixed reading-progress bar plus a sticky table of contents that tracks the
 * currently visible section. Both rely on scroll listeners and an
 * IntersectionObserver; they degrade gracefully if either is unavailable.
 */
export function MethodologyChrome({ items }: MethodologyChromeProps) {
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");
  const rafRef = useRef<number | null>(null);

  // Reading progress: ratio of scrolled distance from top of the article
  // to the end of the article. Bounded to [0, 1] so it never goes negative
  // on rubber-band bounce or jumps past 100% near the footer.
  useEffect(() => {
    const article = document.getElementById("meth-article");
    if (!article) return;

    const compute = () => {
      const rect = article.getBoundingClientRect();
      const viewport = window.innerHeight;
      const total = rect.height - viewport;
      if (total <= 0) {
        setProgress(1);
        return;
      }
      const scrolled = Math.max(0, Math.min(total, -rect.top));
      setProgress(scrolled / total);
    };

    const onScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        compute();
      });
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Active section tracking. Pick the section whose top is closest to a
  // reading-line ~30% from the top of the viewport. Falls back to the first
  // section when nothing intersects yet (e.g. user at top of hero).
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el != null);

    if (sections.length === 0) return;

    let frame: number | null = null;
    const pickActive = () => {
      const probe = window.innerHeight * 0.3;
      let best: { id: string; dist: number } | null = null;
      for (const el of sections) {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0) continue;
        const dist = Math.abs(r.top - probe);
        if (!best || dist < best.dist) {
          best = { id: el.id, dist };
        }
      }
      if (best) setActiveId(best.id);
    };

    const onScroll = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        pickActive();
      });
    };

    pickActive();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [items]);

  const handleJump = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  const pct = useMemo(() => Math.round(progress * 1000) / 10, [progress]);

  return (
    <>
      <div className="read-progress" aria-hidden>
        <div className="read-progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <aside
        className="meth-toc"
        aria-label="Methodology sections"
      >
        <div className="meth-toc__label">On this page</div>
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              className={`meth-toc__item ${active ? "is-active" : ""}`}
              onClick={() => handleJump(item.id)}
              aria-current={active ? "true" : undefined}
            >
              <span className="meth-toc__num">{item.num}</span>
              <span className="meth-toc__rule" />
              <span className="meth-toc__text">{item.title}</span>
            </button>
          );
        })}
      </aside>
    </>
  );
}
