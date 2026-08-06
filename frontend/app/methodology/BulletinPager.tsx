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

  // The front page stands alone, the way a folded newspaper does; everything
  // after it reads as an open spread. 9 leaves -> cover + 4 spreads.
  const views: number[][] = [[0]];
  for (let i = 1; i < leaves.length; i += 2) {
    views.push(leaves.slice(i, i + 2).map((_, k) => i + k));
  }
  const total = views.length;

  const [page, setPage] = useState(0);
  const [paged, setPaged] = useState(false);
  const stage = useRef<HTMLDivElement | null>(null);
  const turning = useRef(false);

  // Only paginate where there is room for it, and only when motion is welcome.
  useEffect(() => {
    const mq = window.matchMedia(
      "(min-width: 1100px) and (prefers-reduced-motion: no-preference)"
    );
    const sync = () => setPaged(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
    },
    [paged, page, total, views]
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
        className={`bull-book__stage${views[page].length === 1 ? " is-cover" : ""}`}
        ref={stage}
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
            ? `Page 1 of ${leaves.length}`
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
