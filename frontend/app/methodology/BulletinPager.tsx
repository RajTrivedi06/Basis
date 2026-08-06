"use client";

import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import gsap from "gsap";

/**
 * The bulletin as a newspaper you turn rather than a page you scroll.
 *
 * Every top-level block handed in becomes one leaf. Nothing is unmounted and
 * nothing is `display: none` — off-leaf pages stay in the DOM at
 * `visibility: hidden`, so Cmd-F, screen readers and crawlers still see the
 * whole bulletin, and an anchor like #file-04 can still be jumped to.
 *
 * Below the spread breakpoint, and under prefers-reduced-motion, this is a
 * plain stack: no 3D, no turning, just the scrolling page it was before.
 */
export function BulletinPager({ children }: { children: ReactNode }) {
  const leaves = Children.toArray(children);

  const [page, setPage] = useState(0);
  const [paged, setPaged] = useState(false);
  const [spreads, setSpreads] = useState(false);

  // A phone has no room for two pages, so it turns one at a time. Wide
  // screens keep the cover-then-spreads shape.
  const views: number[][] = spreads
    ? (() => {
        const v: number[][] = [[0]];
        for (let i = 1; i < leaves.length; i += 2) {
          v.push(leaves.slice(i, i + 2).map((_, k) => i + k));
        }
        return v;
      })()
    : leaves.map((_, i) => [i]);
  const total = views.length;
  const stage = useRef<HTMLDivElement | null>(null);
  const turning = useRef(false);
  const [still, setStill] = useState(false);

  // Turning is on everywhere now; only the shape of a view changes with room.
  // Reduced motion keeps the pager and drops the animation, rather than
  // dropping the whole reader.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1100px)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setSpreads(wide.matches);
      setPaged(true);
      setStill(calm.matches);
    };
    sync();
    wide.addEventListener("change", sync);
    calm.addEventListener("change", sync);
    return () => {
      wide.removeEventListener("change", sync);
      calm.removeEventListener("change", sync);
    };
  }, []);

  // Turning a page should hand the reader its top, not leave them wherever
  // they had scrolled the previous one to.
  const toTop = useCallback(() => {
    const el = stage.current;
    if (el === null) return;
    const y = el.getBoundingClientRect().top + window.scrollY;
    const rail = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--header-rail-h"
      )
    );
    window.scrollTo({
      top: Math.max(0, y - (Number.isFinite(rail) ? rail : 68) - 8),
      behavior: still ? "auto" : "smooth",
    });
  }, [still]);

  const go = useCallback(
    (next: number) => {
      if (!paged || turning.current) return;
      if (next < 0 || next >= total || next === page) return;

      const root = stage.current;
      if (root === null) {
        setPage(next);
        return;
      }

      const forward = next > page;
      // A spread turns on its gutter: the right-hand page of the view being
      // left swings over to become the left-hand page of the next one.
      const fromView = forward ? views[page] : views[next];
      const turnIndex = fromView[fromView.length - 1];
      const leaf = root.querySelector<HTMLElement>(
        `[data-leaf="${turnIndex}"]`
      );
      if (leaf === null) {
        setPage(next);
        return;
      }

      if (still) {
        setPage(next);
        toTop();
        return;
      }

      turning.current = true;
      const shade = leaf.querySelector<HTMLElement>(".bull-leaf__shade");

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set(leaf, { clearProps: "transform,zIndex,willChange" });
          if (shade) gsap.set(shade, { clearProps: "opacity" });
          turning.current = false;
        },
      });

      gsap.set(leaf, { zIndex: 20, willChange: "transform" });
      tl.fromTo(
        leaf,
        { rotateY: forward ? 0 : -168 },
        {
          rotateY: forward ? -168 : 0,
          duration: 0.62,
          ease: "power2.inOut",
          force3D: true,
        },
        0
      );
      // Light raking across the turning face. A bare rotateY reads as a
      // flipping card; the moving shadow is what makes it read as paper.
      if (shade) {
        tl.fromTo(
          shade,
          { opacity: forward ? 0 : 0.55 },
          { opacity: forward ? 0.55 : 0, duration: 0.31, ease: "power1.in" },
          0
        ).to(shade, { opacity: forward ? 0 : 0.55, duration: 0.31, ease: "power1.out" }, 0.31);
      }

      setPage(next);
      toTop();
    },
    [paged, page, total, views, still, toTop]
  );


  // —— The thumb ——
  // `touch-action: pan-y` on the stage leaves vertical scrolling to the
  // browser and hands us the horizontal gestures, so a swipe to turn and a
  // scroll to read never fight over the same finger. The first few pixels
  // decide the axis; once vertical wins we stay out of the way entirely.
  const drag = useRef<{
    x: number;
    y: number;
    axis: "" | "x" | "y";
    t: number;
  } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!paged || turning.current) return;
    if (e.pointerType === "mouse") return;
    drag.current = { x: e.clientX, y: e.clientY, axis: "", t: Date.now() };
  }, [paged]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (d === null) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;

      if (d.axis === "") {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (d.axis !== "x") return;

      const cur = stage.current?.querySelector<HTMLElement>(
        ".bull-spread[data-current]"
      );
      if (!cur) return;
      // Resist at the ends so the paper feels bound, not broken.
      const atEnd = (dx > 0 && page === 0) || (dx < 0 && page === total - 1);
      gsap.set(cur, { x: atEnd ? dx * 0.25 : dx });
    },
    [page, total]
  );

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (d === null || d.axis !== "x") return;

      const cur = stage.current?.querySelector<HTMLElement>(
        ".bull-spread[data-current]"
      );
      const dx = e.clientX - d.x;
      const width = stage.current?.clientWidth ?? 1;
      const velocity = Math.abs(dx) / Math.max(1, Date.now() - d.t);
      // A short flick counts as much as a long drag.
      const commit = Math.abs(dx) > width * 0.22 || velocity > 0.45;

      if (cur) gsap.to(cur, { x: 0, duration: 0.28, ease: "power2.out" });
      if (!commit) return;
      go(dx < 0 ? page + 1 : page - 1);
    },
    [go, page]
  );

  // Arrow keys turn the page, as they would in any reader.
  useEffect(() => {
    if (!paged) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "ArrowRight") go(page + 1);
      if (e.key === "ArrowLeft") go(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paged, page, go]);

  // A jump to #file-04 has to bring its leaf forward, not scroll to a hidden one.
  useEffect(() => {
    if (!paged) return;
    const jump = () => {
      const id = window.location.hash.slice(1);
      if (!id) return;
      const el = document.getElementById(id);
      const leaf = el?.closest<HTMLElement>("[data-leaf]");
      if (leaf) {
        const idx = Number(leaf.dataset.leaf);
        const v = views.findIndex((g) => g.includes(idx));
        if (v >= 0) setPage(v);
      }
    };
    jump();
    window.addEventListener("hashchange", jump);
    return () => window.removeEventListener("hashchange", jump);
  }, [paged, views]);

  if (!paged) {
    return <>{children}</>;
  }

  return (
    <div className="bull-book">
      <div
        className={`bull-book__stage${
          spreads && views[page].length === 1 ? " is-cover" : ""
        }${spreads ? "" : " is-single"}`}
        ref={stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {views.map((group, v) => (
          <div
            key={v}
            className="bull-spread"
            data-current={v === page ? "" : undefined}
            aria-hidden={v === page ? undefined : true}
          >
            {group.map((i) => (
              <div key={i} data-leaf={i} className="bull-leaf">
                <div className="bull-leaf__face">{leaves[i]}</div>
                <div className="bull-leaf__shade" aria-hidden />
              </div>
            ))}
          </div>
        ))}
      </div>

      <nav className="bull-pager" aria-label="Bulletin pages">
        <button
          type="button"
          className="bull-pager__btn"
          onClick={() => go(page - 1)}
          disabled={page === 0}
        >
          ◀ Previous
        </button>
        <span className="bull-pager__count">
          {views[page].length === 1
            ? `Page ${views[page][0] + 1} of ${leaves.length}`
            : `Pages ${views[page][0] + 1}\u2013${
                views[page][views[page].length - 1] + 1
              } of ${leaves.length}`}
        </span>
        <button
          type="button"
          className="bull-pager__btn"
          onClick={() => go(page + 1)}
          disabled={page === total - 1}
        >
          Next ▶
        </button>
      </nav>
    </div>
  );
}
